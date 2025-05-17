import * as Mocha from 'mocha';
import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';
import {TestEventsEnum, createLogger} from "@testpig/shared";

class MochaReporter extends Mocha.reporters.Spec {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private logger = createLogger('MochaReporter');

    constructor(runner: Mocha.Runner, options: Mocha.MochaOptions) {
        super(runner, options);

        const projectId = options?.reporterOptions?.projectId || process.env.TESTPIG_PROJECT_ID;
        const runId = options?.reporterOptions?.runId || process.env.TESTPIG_RUN_ID;

        if (!projectId) {
            throw new Error('projectId is required in reporterOptions or set in TESTPIG_PROJECT_ID environment variable');
        }

        this.eventHandler = new TestEventHandler(projectId, runId);
        this.logger.info(`Initialized with projectId: ${projectId}, runId: ${runId || 'not specified'}`);
        this.setupEventHandlers(runner);
    }

    private setupEventHandlers(runner: Mocha.Runner) {
        runner.on('start', () => {
            this.logger.info('Test run starting');
            const data = this.eventHandler.eventNormalizer.normalizeRunStart();
            this.eventHandler.queueEvent(TestEventsEnum.RUN_START, data);
        });

        runner.on('suite', (suite: Mocha.Suite) => {
            if (!suite.title || suite.root) return;

            const suiteId = uuidv4();
            (suite as any).testSuiteId = suiteId;
            this.logger.debug(`Suite started: ${suite.title}`);

            const data = this.eventHandler.eventNormalizer.normalizeSuiteStart(
                suiteId,
                suite.title,
                suite.file || 'unknown',
                suite.tests.length,
                {
                    os: process.platform,
                    architecture: process.arch,
                    browser: 'Node.js',
                    framework: 'Mocha',
                    frameworkVersion: require('mocha/package.json').version
                },
                'unit'
            );
            this.eventHandler.queueEvent(TestEventsEnum.SUITE_START, data);
        });

        runner.on('test', (test: Mocha.Test) => {
            const testId = uuidv4();
            (test as any).testCaseId = testId;
            this.logger.debug(`Test started: ${test.title}`);

            const data = this.eventHandler.eventNormalizer.normalizeTestStart(
                testId,
                test.title,
                test.file || 'unknown',
                test.body || '',
                {
                    rabbitMqId: (test.parent as any)?.testSuiteId,
                    title: test.parent?.title
                }
            );
            this.eventHandler.queueEvent(TestEventsEnum.TEST_START, data);
        });

        runner.on('pass', (test: Mocha.Test) => {
            this.logger.debug(`Test passed: ${test.title}`);
            const data = this.eventHandler.eventNormalizer.normalizeTestPass(
                {
                    testId: (test as any).testCaseId,
                    title: test.title,
                    duration: test.duration || 0,
                    testSuite: {
                        rabbitMqId: (test.parent as any)?.testSuiteId,
                        title: test.parent?.title
                    }
                }
            );
            this.eventHandler.queueEvent(TestEventsEnum.TEST_PASS, data);
        });

        runner.on('fail', (test: Mocha.Test, err: Error) => {
            this.failureCount++;
            this.logger.debug(`Test failed: ${test.title}`, err.message);
            const data = this.eventHandler.eventNormalizer.normalizeTestFail(
                {
                    testId: (test as any).testCaseId,
                    title: test.title,
                    error: err.message,
                    stack: err.stack || '',
                    testSuite: {
                        rabbitMqId: (test.parent as any)?.testSuiteId,
                        title: test.parent?.title
                    }
                });
            this.eventHandler.queueEvent(TestEventsEnum.TEST_FAIL, data);
        });

        runner.on('suite end', (suite: Mocha.Suite) => {
            if (!suite.title || suite.root) return;

            const hasFailed = suite.tests.some(t => t.state === 'failed');
            this.logger.debug(`Suite ended: ${suite.title}, hasFailed: ${hasFailed}`);
            const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
                (suite as any).testSuiteId,
                suite.title,
                hasFailed
            );
            this.eventHandler.queueEvent(TestEventsEnum.SUITE_END, data);
        });

        runner.on('end', async () => {
            const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
            this.eventHandler.queueEvent(TestEventsEnum.RUN_END, data);
            
            this.logger.info("Finishing Mocha test run, waiting for API calls to complete...");
            
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
            
            // We'll still use a process.exit but with a longer delay
            // This ensures tests won't hang indefinitely if something goes wrong
            // with the network requests
            process.exitCode = this.failureCount > 0 ? 1 : 0;
        });
    }
}

// Export in a way that Mocha can understand
module.exports = MochaReporter;