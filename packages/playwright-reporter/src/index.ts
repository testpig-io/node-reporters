import {Reporter, TestCase, TestResult, TestStep, TestError, FullConfig, Suite} from '@playwright/test/reporter';
import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';
import fs from 'fs';
import {TestEventsEnum, createLogger, getSystemInfo } from "@testpig/shared";

interface SuiteInfo {
    id: string;
    title: string;
    file: string;
}

class PlaywrightReporter implements Reporter {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private currentSuite: SuiteInfo | null = null;
    private logger = createLogger('PlaywrightReporter');

    constructor(options: { projectId?: string; runId?: string } = {}) {
        const projectId = options.projectId || process.env.TESTPIG_PROJECT_ID;
        const runId = options.runId || process.env.TESTPIG_RUN_ID;

        if (!projectId) {
            throw new Error('projectId is required in reporter options or set in TESTPIG_PROJECT_ID environment variable');
        }

        this.eventHandler = new TestEventHandler(projectId, runId);
        this.logger.info(`Initialized with projectId: ${projectId}, runId: ${runId || 'not specified'}`);
    }

    onBegin(config: FullConfig, suite: Suite): void {
        this.logger.info('Test run starting');
        const data = this.eventHandler.eventNormalizer.normalizeRunStart();
        this.eventHandler.queueEvent(TestEventsEnum.RUN_START, data);
    }

    onTestBegin(test: TestCase): void {
        // Handle suite start if it's a new suite
        const suitePath = test.location.file;
        const suiteTitle = this.getSuiteTitle(test);

        if (!this.currentSuite || this.currentSuite.file !== suitePath) {
            if (this.currentSuite) {
                // End previous suite
                this.logger.debug(`Suite ended: ${this.currentSuite.title}`);
                const suiteEndData = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
                    this.currentSuite.id,
                    this.currentSuite.title,
                    false
                );
                this.eventHandler.queueEvent(TestEventsEnum.SUITE_END, suiteEndData);
            }

            const suiteId = uuidv4();
            this.currentSuite = {
                id: suiteId,
                title: suiteTitle,
                file: suitePath
            };
            this.logger.debug(`Suite started: ${suiteTitle}`);

            const suiteData = this.eventHandler.eventNormalizer.normalizeSuiteStart(
                suiteId,
                suiteTitle,
                suitePath,
                1, // We'll get actual count from suite
                {
                    os: process.platform,
                    architecture: process.arch,
                    browser: test.parent.project()?.name || 'chromium',
                    framework: 'Playwright',
                    frameworkVersion: require('@playwright/test/package.json').version,
                    nodeVersion: getSystemInfo().nodeVersion,
                    npmVersion: getSystemInfo().npmVersion
                },
                'e2e'
            );

            this.eventHandler.queueEvent(TestEventsEnum.SUITE_START, suiteData);
        }

        // Handle test start
        const testId = uuidv4();
        const testBody = this.getTestBody(test);
        this.logger.debug(`Test started: ${test.title}`);

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
        this.eventHandler.queueEvent(TestEventsEnum.TEST_START, testData);

        // Store test ID for later use
        (test as any).testCaseId = testId;
    }

    onTestEnd(test: TestCase, result: TestResult): void {
        const testId = (test as any).testCaseId;

        if (result.status === 'passed') {
            this.logger.debug(`Test passed: ${test.title}`);
            const data = this.eventHandler.eventNormalizer.normalizeTestPass(
                {
                    testId,
                    title: test.title,
                    duration: result.duration ? Math.ceil(result.duration) : undefined,
                    retries: result.retry,
                    testSuite: {
                        rabbitMqId: this.currentSuite!.id,
                        title: this.currentSuite!.title
                    }
                }
            );
            this.eventHandler.queueEvent(TestEventsEnum.TEST_PASS, data);
        } else if (result.status === 'failed') {
            this.failureCount++;
            const error = result.error || {};
            this.logger.debug(`Test failed: ${test.title}`, error.message);
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
            this.eventHandler.queueEvent(TestEventsEnum.TEST_FAIL, data);
        } else if (result.status === 'skipped') {
            this.logger.debug(`Test skipped: ${test.title}`);
            const data = this.eventHandler.eventNormalizer.normalizeTestSkip(
                {
                    testId,
                    title: test.title,
                    testSuite: {
                        rabbitMqId: this.currentSuite!.id,
                        title: this.currentSuite!.title
                    }
                }
            );
            this.eventHandler.queueEvent(TestEventsEnum.TEST_END, data);
        } else if (result.status === 'timedOut' || result.status === 'interrupted') {
            this.logger.debug(`Test ${result.status}: ${test.title}`);
            const data = this.eventHandler.eventNormalizer.normalizeTestPending(
                {
                    testId,
                    title: test.title,
                    testSuite: {
                        rabbitMqId: this.currentSuite!.id,
                        title: this.currentSuite!.title
                    }
                }
            );
            this.eventHandler.queueEvent(TestEventsEnum.TEST_END, data);
        }
    }

    async onEnd(): Promise<void> {
        // End the last suite if exists
        if (this.currentSuite) {
            this.logger.debug(`Suite ended: ${this.currentSuite.title}`);
            const suiteEndData = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
                this.currentSuite.id,
                this.currentSuite.title,
                false
            );
            this.eventHandler.queueEvent(TestEventsEnum.SUITE_END, suiteEndData);
        }

        const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
        this.eventHandler.queueEvent('end', data);
        
        this.logger.info("Finishing Playwright test run, waiting for API calls to complete...");
        
        // Wait for the queue to be processed - this is critical!
        await this.eventHandler.processEventQueue();
        
        // Give network requests time to complete
        this.logger.info("Waiting for network requests to complete...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.logger.info("Network wait period complete, exiting normally");
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
            this.logger.error('Error reading test file:', error);
            return '';
        }
    }
}

export default PlaywrightReporter;