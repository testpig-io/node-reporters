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

            const testBodies = new Map<string, TestBody>();
            const lines = content.split('\n');

            if (isCucumber) {
                this.parseCucumberFile(lines, testBodies);
            } else {
                this.parseMochaFile(lines, testBodies);
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
        let currentFeature: string | null = null;
        let scenarioStart = -1;

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('Feature:')) {
                // Extract Feature name as suite
                currentFeature = trimmedLine.substring('Feature:'.length).trim();
            } else if (trimmedLine.startsWith('Scenario:')) {
                // Save the previous scenario if applicable
                if (currentScenario !== null && scenarioStart !== -1) {
                    const scenarioBody = lines
                        .slice(scenarioStart + 1, index)
                        .map(l => l.trim())
                        .filter(l => l && !l.startsWith('Scenario:') && !l.startsWith('Feature:'))
                        .join('\n');

                    testBodies.set(currentScenario, {
                        content: scenarioBody,
                        type: 'cucumber'
                    });
                }

                // Start a new scenario
                currentScenario = trimmedLine.substring('Scenario:'.length).trim();
                scenarioStart = index;
            }
        });

        // Handle the last scenario
        if (currentScenario !== null && scenarioStart !== -1) {
            const scenarioBody = lines
                .slice(scenarioStart + 1)
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('Scenario:') && !l.startsWith('Feature:'))
                .join('\n');

            testBodies.set(currentScenario, {
                content: scenarioBody,
                type: 'cucumber'
            });
        }

        // Save the suite name (Feature) if found
        if (currentFeature) {
            testBodies.set('suiteName', {
                content: currentFeature,
                type: 'cucumber'
            });
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
}