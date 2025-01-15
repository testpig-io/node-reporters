import * as Mocha from 'mocha';
import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';
import {TestEventsEnum} from "@testpig/shared";

class MochaReporter extends Mocha.reporters.Spec {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;

    constructor(runner: Mocha.Runner, options: Mocha.MochaOptions) {
        super(runner, options);

        const {projectId, runId} = options.reporterOptions;

        if (!projectId) {
            throw new Error('projectId is required in reporterOptions');
        }

        this.eventHandler = new TestEventHandler(projectId, runId);
        this.setupEventHandlers(runner);
    }

    private setupEventHandlers(runner: Mocha.Runner) {
        runner.on('start', () => {
            const data = this.eventHandler.eventNormalizer.normalizeRunStart();
            this.eventHandler.queueEvent(TestEventsEnum.RUN_START, data);
        });

        runner.on('suite', (suite: Mocha.Suite) => {
            if (!suite.title || suite.root) return;

            const suiteId = uuidv4();
            (suite as any).testSuiteId = suiteId;

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
        })
        ;

        runner.on('suite end', (suite: Mocha.Suite) => {
            if (!suite.title || suite.root) return;

            const hasFailed = suite.tests.some(t => t.state === 'failed');
            const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
                (suite as any).testSuiteId,
                suite.title,
                hasFailed
            );
            this.eventHandler.queueEvent(TestEventsEnum.SUITE_END, data);
        });

        runner.on('end', () => {
            const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
            this.eventHandler.queueEvent(TestEventsEnum.RUN_END, data);
            this.eventHandler.processEventQueue();

            // Exit with appropriate code after a short delay to allow event queue processing
            setTimeout(() => {
                process.exit(this.failureCount > 0 ? 1 : 0);
            }, 100);
        });
    }
}

// Export in a way that Mocha can understand
module.exports = MochaReporter;