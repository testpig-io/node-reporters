import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'fs';

interface TestBodyInfo {
    body: string;
    path: string;
    title: string;
}

export class TestBodyCache {
    private fileCache = new Map<string, {
        content: string;
        ast: any;
        bodies: Map<string, string>;
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
                    bodies: new Map()
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

    clear(): void {
        this.fileCache.clear();
    }
}