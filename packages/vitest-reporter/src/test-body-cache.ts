import fs from 'fs';

interface TestBody {
    content: string;
}

export class TestBodyCache {
    private fileCache = new Map<string, {
        content: string;
        testBodies: Map<string, TestBody>;
    }>();

    cacheTestBodies(filePath: string): void {
        if (!filePath || this.fileCache.has(filePath)) return;

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const testBodies = new Map<string, TestBody>();
            const lines = content.split('\n');

            this.parseVitestFile(lines, testBodies);

            this.fileCache.set(filePath, {
                content,
                testBodies
            });
        } catch (error) {
            console.error(`Error caching test bodies for ${filePath}:`, error);
        }
    }

    getTestBody(filePath: string, title: string): string {
        const fileInfo = this.fileCache.get(filePath);
        if (!fileInfo) return '';

        const testBody = fileInfo.testBodies.get(title);
        return testBody?.content || '';
    }

    clear(): void {
        this.fileCache.clear();
    }

    private parseVitestFile(lines: string[], testBodies: Map<string, TestBody>): void {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Match test/it function calls with various string delimiter types
            const testMatch = line.match(/(?:test|it)\s*\(\s*(['"`])(.*?)\1/);

            if (testMatch) {
                const title = testMatch[2];
                let braceCount = 0;
                let foundStart = false;
                let startLine = i;
                let endLine = i;

                // Find the start and end of the test function
                for (let j = i; j < lines.length; j++) {
                    const currentLine = lines[j];

                    if (!foundStart && currentLine.includes('=>') || currentLine.includes('{')) {
                        foundStart = true;
                        startLine = j;
                    }

                    if (foundStart) {
                        braceCount += (currentLine.match(/{/g) || []).length;
                        braceCount -= (currentLine.match(/}/g) || []).length;

                        if (braceCount === 0) {
                            endLine = j;
                            break;
                        }
                    }
                }

                const testBody = lines
                    .slice(startLine, endLine + 1)
                    .join('\n')
                    .trim();

                testBodies.set(title, { content: testBody });
            }
        }
    }
} 