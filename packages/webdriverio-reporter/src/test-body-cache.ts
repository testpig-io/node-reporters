import fs from 'fs';

interface TestBody {
    content: string;
    type: 'cucumber' | 'mocha';
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
            const isCucumber = content.includes('Feature:');

            console.log("CONTENT!: ", content)

            const testBodies = new Map<string, TestBody>();
            const lines = content.split('\n');

            if (isCucumber) {
                console.log("IN CUCUMBER")
                this.parseCucumberFile(lines, testBodies);
            } else {
                return;
            }

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

    private parseCucumberFile(lines: string[], testBodies: Map<string, TestBody>): void {
        let currentScenario: string | null = null;
        let scenarioStart = -1;

        lines.forEach((line, index) => {
            console.log("SCENARIO: ", currentScenario)
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('Scenario:')) {
                // If we were processing a previous scenario, save it
                if (currentScenario !== null && scenarioStart !== -1) {
                    this.saveScenario(lines, scenarioStart, index - 1, currentScenario, testBodies);
                }

                currentScenario = trimmedLine.substring('Scenario:'.length).trim();
                scenarioStart = index;
            } else if (trimmedLine.startsWith('Feature:') || trimmedLine === '') {
                // End of current scenario
                if (currentScenario !== null && scenarioStart !== -1) {
                    this.saveScenario(lines, scenarioStart, index - 1, currentScenario, testBodies);
                    currentScenario = null;
                    scenarioStart = -1;
                }
            }
        });

        // Save the last scenario if exists
        if (currentScenario !== null && scenarioStart !== -1) {
            this.saveScenario(lines, scenarioStart, lines.length - 1, currentScenario, testBodies);
        }
    }

    private parseMochaFile(lines: string[], testBodies: Map<string, TestBody>): void {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const testMatch = line.match(/(?:it|test)\s*\(\s*(['"`])(.*?)\1/);

            if (testMatch) {
                const title = testMatch[2];
                let braceCount = 0;
                let foundStart = false;
                let endLine = i;

                // Find the end of the test function
                for (let j = i; j < lines.length; j++) {
                    const currentLine = lines[j];

                    if (!foundStart && currentLine.includes('{')) {
                        foundStart = true;
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

                const testBody = lines.slice(i, endLine + 1).join('\n');
                testBodies.set(title, {
                    content: testBody,
                    type: 'mocha'
                });
            }
        }
    }

    private saveScenario(
        lines: string[],
        start: number,
        end: number,
        title: string,
        testBodies: Map<string, TestBody>
    ): void {
        const content = lines
            .slice(start, end + 1)
            .map(line => line.trim())
            .filter(line => line)
            .join('\n');

        testBodies.set(title, {
            content,
            type: 'cucumber'
        });
    }
}