import {Reporter, ReporterOnStartOptions, Test, TestContext, TestResult} from '@jest/reporters';
import {AggregatedResult} from '@jest/test-result';
import {Config} from '@jest/types';
import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';
import {TestBodyCache} from './test-body-cache';
import {TestEventsEnum, createLogger} from "@testpig/shared";

class JestReporter implements Reporter {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private suiteMap = new Map<string, { id: string; title: string }>();
    private testBodyCache = new TestBodyCache();
    private logger = createLogger('JestReporter');

    constructor(globalConfig: Config.GlobalConfig, options: { projectId?: string; runId?: string } = {}) {
        const projectId = options?.projectId || process.env.TESTPIG_PROJECT_ID;
        const runId = options?.runId || process.env.TESTPIG_RUN_ID;

        if (!projectId) {
            throw new Error('projectId is required in reporter options or set in TESTPIG_PROJECT_ID environment variable');
        }

        this.eventHandler = new TestEventHandler(projectId, runId);
        this.logger.info(`Initialized with projectId: ${projectId}, runId: ${runId || 'not specified'}`);
    }

    onRunStart(): void {
        this.logger.info('Test run starting');
        const data = this.eventHandler.eventNormalizer.normalizeRunStart();
        this.eventHandler.queueEvent(TestEventsEnum.RUN_START, data);
    }

    onTestStart(test: Test): void {
        const suitePath = test.path;
        if (!this.suiteMap.has(suitePath)) {
            const suiteId = uuidv4();
            const suiteTitle = this.getSuiteTitle(test);

            this.suiteMap.set(suitePath, {id: suiteId, title: suiteTitle});
            this.logger.debug(`Suite started: ${suiteTitle}`);

            const data = this.eventHandler.eventNormalizer.normalizeSuiteStart(
                suiteId,
                suiteTitle,
                suitePath,
                1,
                {
                    os: process.platform,
                    architecture: process.arch,
                    browser: 'Node.js',
                    framework: 'Jest',
                    frameworkVersion: require('jest/package.json').version
                },
                'unit'
            );
            this.eventHandler.queueEvent(TestEventsEnum.SUITE_START, data);
        }
    }

    onTestResult(test: Test, testResult: TestResult): void {
        const suite = this.suiteMap.get(test.path);
        if (!suite) return;

        testResult.testResults.forEach(result => {
            const testId = uuidv4();
            const testBody = this.testBodyCache.getTestBody(test.path, result.title);
            this.logger.debug(`Processing test result: ${result.title}, status: ${result.status}`);

            // Send test start event
            const startData = this.eventHandler.eventNormalizer.normalizeTestStart(
                testId,
                result.title,
                test.path,
                testBody,
                {
                    rabbitMqId: suite.id,
                    title: suite.title
                }
            );
            this.eventHandler.queueEvent(TestEventsEnum.TEST_START, startData);

            if (result.status === 'passed') {
                this.logger.debug(`Test passed: ${result.title}`);
                const passData = this.eventHandler.eventNormalizer.normalizeTestPass({
                        testId,
                        title: result.title,
                        duration: result.duration || 0,
                        testSuite: {
                            rabbitMqId: suite.id,
                            title: suite.title
                        }
                    }
                );
                this.eventHandler.queueEvent(TestEventsEnum.TEST_PASS, passData);
            } else if (result.status === 'failed') {
                this.failureCount++;
                this.logger.debug(`Test failed: ${result.title}`);
                // @ts-expect-error - matcherResult is not defined in the type
                const errorMessage = result.failureDetails?.[0]?.matcherResult?.message || result.failureMessages.join('\n');
                const stackTrace = result.failureMessages.join('\n');

                const failData = this.eventHandler.eventNormalizer.normalizeTestFail({
                    testId,
                    title: result.title,
                    error: errorMessage,
                    stack: stackTrace,
                    testSuite: {
                        rabbitMqId: suite.id,
                        title: suite.title
                    }
                });
                this.eventHandler.queueEvent(TestEventsEnum.TEST_FAIL, failData);
            } else if (result.status === 'pending') {
                const pendingData = this.eventHandler.eventNormalizer.normalizeTestSkip({
                    testId,
                    title: result.title,
                    testSuite: {
                        rabbitMqId: suite.id,
                        title: suite.title
                    }
                });

                this.eventHandler.queueEvent(TestEventsEnum.TEST_END, pendingData);
            }
        });

        // Send suite end event
        const hasFailed = testResult.testResults.some(r => r.status === 'failed');
        this.logger.debug(`Suite ended: ${suite.title}, hasFailed: ${hasFailed}`);
        const suiteEndData = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
            suite.id,
            suite.title,
            hasFailed
        );
        this.eventHandler.queueEvent(TestEventsEnum.SUITE_END, suiteEndData);
    }

    async onRunComplete(): Promise<void> {
        const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
        this.eventHandler.queueEvent(TestEventsEnum.RUN_END, data);
        
        this.logger.info("Finishing Jest test run, waiting for API calls to complete...");
        
        try {
            // Process the event queue and wait for it to complete
            await this.eventHandler.processEventQueue();
            
            // Add a longer delay to ensure network requests have time to complete
            // This is critical for preventing process termination before requests finish
            this.logger.info("Waiting for network requests to complete...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.logger.info("Network wait period complete, exiting normally");
        } catch (error) {
            this.logger.error("Error processing event queue:", error);
        }
        
        // Clear the cache
        this.testBodyCache.clear();
        
        // Set the exit code instead of calling process.exit directly
        process.exitCode = this.failureCount > 0 ? 1 : 0;
    }

    private getSuiteTitle(test: Test): string {
        const parts = test.path.split('/');
        return parts[parts.length - 1].replace(/\.[^/.]+$/, '');
    }

    getLastError(): Error | undefined {
        return undefined;
    }
}

export = JestReporter;