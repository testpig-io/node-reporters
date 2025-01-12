import {Reporter, TestCase, TestResult, TestStep, TestError, FullConfig, Suite} from '@playwright/test/reporter';
import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';
import fs from 'fs';

interface SuiteInfo {
    id: string;
    title: string;
    file: string;
}

class PlaywrightReporter implements Reporter {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private currentSuite: SuiteInfo | null = null;

    constructor(options: { projectId?: string; runId?: string } = {}) {
        if (!options.projectId) {
            throw new Error('projectId is required in reporter options');
        }

        this.eventHandler = new TestEventHandler(options.projectId, options.runId);
    }

    onBegin(config: FullConfig, suite: Suite): void {
        const data = this.eventHandler.eventNormalizer.normalizeRunStart();
        this.eventHandler.queueEvent('start', data);
    }

    onTestBegin(test: TestCase): void {
        // Handle suite start if it's a new suite
        const suitePath = test.location.file;
        const suiteTitle = this.getSuiteTitle(test);

        if (!this.currentSuite || this.currentSuite.file !== suitePath) {
            if (this.currentSuite) {
                // End previous suite
                const suiteEndData = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
                    this.currentSuite.id,
                    this.currentSuite.title,
                    false
                );
                this.eventHandler.queueEvent('suite end', suiteEndData);
            }

            const suiteId = uuidv4();
            this.currentSuite = {
                id: suiteId,
                title: suiteTitle,
                file: suitePath
            };

            const suiteData = this.eventHandler.eventNormalizer.normalizeSuiteStart(
                suiteId,
                suiteTitle,
                suitePath,
                1, // We'll get actual count from suite
                {
                    os: process.platform,
                    architecture: process.arch,
                    browser: test.parent.project()?.use.browserName || 'chromium',
                    framework: 'Playwright',
                    frameworkVersion: require('@playwright/test/package.json').version
                },
                'e2e'
            );
            this.eventHandler.queueEvent('suite', suiteData);
        }

        // Handle test start
        const testId = uuidv4();
        const testBody = this.getTestBody(test);

        const testData = this.eventHandler.eventNormalizer.normalizeTestStart(
            testId,
            test.title,
            test.location.file,
            testBody,
            {
                rabbitMqId: this.currentSuite.id,
                title: this.currentSuite.title
            }
        );
        this.eventHandler.queueEvent('test', testData);

        // Store test ID for later use
        (test as any).testCaseId = testId;
    }

    onTestEnd(test: TestCase, result: TestResult): void {
        const testId = (test as any).testCaseId;

        if (result.status === 'passed') {
            const data = this.eventHandler.eventNormalizer.normalizeTestPass(
                {
                    testId,
                    title: test.title,
                    duration: result.duration,
                    testSuite: {
                        rabbitMqId: this.currentSuite!.id,
                        title: this.currentSuite!.title
                    }
                }
            );
            this.eventHandler.queueEvent('pass', data);
        } else if (result.status === 'failed') {
            this.failureCount++;
            const error = result.error || {};
            const data = this.eventHandler.eventNormalizer.normalizeTestFail(
                {
                    testId,
                    title: test.title,
                    error: error.message || 'Test failed',
                    stack: error.stack || '',
                    testSuite: {
                        rabbitMqId: this.currentSuite!.id,
                        title: this.currentSuite!.title
                    }
                }
            );
            this.eventHandler.queueEvent('fail', data);
        }
    }

    onEnd(): void {
        // End the last suite if exists
        if (this.currentSuite) {
            const suiteEndData = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
                this.currentSuite.id,
                this.currentSuite.title,
                false
            );
            this.eventHandler.queueEvent('suite end', suiteEndData);
        }

        const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
        this.eventHandler.queueEvent('end', data);
        this.eventHandler.processEventQueue();
    }

    private getSuiteTitle(test: TestCase): string {
        const parts = test.location.file.split('/');
        return parts[parts.length - 1].replace(/\.[^/.]+$/, '');
    }

    private getTestBody(test: TestCase): string {
        try {
            const content = fs.readFileSync(test.location.file, 'utf8');
            const lines = content.split('\n');

            // Playwright provides line numbers for test locations
            const startLine = test.location.line - 1;
            let endLine = startLine;

            // Find the end of the test by looking for closing brace
            let braceCount = 0;
            let foundStart = false;

            for (let i = startLine; i < lines.length; i++) {
                const line = lines[i];

                if (!foundStart && line.includes('test(')) {
                    foundStart = true;
                }

                if (foundStart) {
                    braceCount += (line.match(/{/g) || []).length;
                    braceCount -= (line.match(/}/g) || []).length;

                    if (braceCount === 0) {
                        endLine = i;
                        break;
                    }
                }
            }

            return lines.slice(startLine, endLine + 1).join('\n');
        } catch (error) {
            console.error('Error reading test file:', error);
            return '';
        }
    }
}

export default PlaywrightReporter;