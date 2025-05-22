import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'fs';

interface TestBodyInfo {
    body: string;
    path: string;
    title: string;
}

interface TestPathInfo {
    title: string;
    parent?: string;
}

export class TestBodyCache {
    private fileCache = new Map<string, {
        content: string;
        ast: any;
        bodies: Map<string, string>;
        describeMap: Map<string, string>; // Map of test title to parent describe title
    }>();

    getTestBody(filePath: string, testTitle: string): string {
        // Check if file is already cached
        let fileInfo = this.fileCache.get(filePath);

        if (!fileInfo) {
            // Parse file and cache results
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const ast = parse(content, {
                    sourceType: 'module',
                    plugins: ['typescript', 'jsx'],
                });

                fileInfo = {
                    content,
                    ast,
                    bodies: new Map(),
                    describeMap: new Map()
                };

                // Parse all test bodies in the file
                traverse(ast, {
                    CallExpression(path) {
                        const callee = path.node.callee;

                        if (callee.type === 'Identifier' &&
                            (callee.name === 'it' || callee.name === 'test')) {
                            const [titleNode, bodyNode] = path.node.arguments;

                            if (titleNode?.type === 'StringLiteral' && bodyNode) {
                                const title = titleNode.value;
                                const body = fileInfo!.content.slice(bodyNode.start!, bodyNode.end!);
                                fileInfo!.bodies.set(title, body);
                                
                                // Find parent describe block
                                let parent = path.findParent(p => {
                                    if (!p.isCallExpression()) return false;
                                    const calleeNode = p.node.callee;
                                    return (
                                        calleeNode.type === 'Identifier' && 
                                        calleeNode.name === 'describe'
                                    );
                                });
                                
                                if (parent && parent.node.type === 'CallExpression') {
                                    const describeArgs = parent.node.arguments;
                                    if (describeArgs[0]?.type === 'StringLiteral') {
                                        fileInfo!.describeMap.set(title, describeArgs[0].value);
                                    }
                                }
                            }
                        }
                    }
                });

                this.fileCache.set(filePath, fileInfo);
            } catch (error) {
                console.error('Error parsing test file:', error);
                return '';
            }
        }

        return fileInfo.bodies.get(testTitle) || '';
    }

    getDescribeTitle(filePath: string, testTitle: string): string {
        let fileInfo = this.fileCache.get(filePath);
        
        // If file is not cached, call getTestBody to populate the cache
        if (!fileInfo) {
            this.getTestBody(filePath, testTitle);
            fileInfo = this.fileCache.get(filePath);
        }
        
        if (fileInfo && fileInfo.describeMap) {
            return fileInfo.describeMap.get(testTitle) || '';
        }
        
        return '';
    }

    clear(): void {
        this.fileCache.clear();
    }
}