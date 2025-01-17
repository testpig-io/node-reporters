import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';
import {TestEventsEnum} from "@testpig/shared";
import {spawnSync} from "node:child_process";

interface CypressReporterOptions {
    projectId?: string;
    runId?: string;
}

class CypressReporter {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private reporterOptions;

    constructor(runner: any, options: { reporterOptions?: CypressReporterOptions } = {}) {
        this.reporterOptions = options.reporterOptions || {};

        if (!this.reporterOptions.projectId) {
            throw new Error('projectId is required in reporterOptions');
        }

        this.eventHandler = new TestEventHandler(this.reporterOptions.projectId, this.reporterOptions.runId);
        this.setupEventHandlers(runner);
    }

    private setupEventHandlers(runner: any) {
        runner.on('start', () => {
            const data = this.eventHandler.eventNormalizer.normalizeRunStart();
            this.eventHandler.queueEvent(TestEventsEnum.RUN_START, data);
        });

        runner.on('suite', (suite: any) => {
            if (!suite.title || suite.root) return;

            const suiteId = uuidv4();
            suite.testSuiteId = suiteId;

            const data = this.eventHandler.eventNormalizer.normalizeSuiteStart(
                suiteId,
                suite.title,
                suite.invocationDetails.relativeFile,
                suite.tests?.length || 0,
                {
                    os: process.platform,
                    architecture: process.arch,
                    browser: 'Chrome', // Default to Chrome as we can't access Cypress.browser here
                    framework: 'Cypress',
                    frameworkVersion: require('cypress/package.json').version
                },
                'e2e'
            );
            this.eventHandler.queueEvent(TestEventsEnum.SUITE_START, data);
        });

        runner.on('test', (test: any) => {
            const testId = uuidv4();
            test.testCaseId = testId;

            const data = this.eventHandler.eventNormalizer.normalizeTestStart(
                testId,
                test.title,
                test.invocationDetails.relativeFile,
                test.body,
                {
                    rabbitMqId: test.parent?.testSuiteId,
                    title: test.parent?.title
                }
            );
            this.eventHandler.queueEvent(TestEventsEnum.TEST_START, data);
        });

        runner.on('pass', (test: any) => {
            const data = this.eventHandler.eventNormalizer.normalizeTestPass({
                    testId: test.testCaseId,
                    title: test.title,
                    duration: test.duration,
                    testSuite: {
                        rabbitMqId: test.parent?.testSuiteId,
                        title: test.parent?.title
                    },
                    retries: test._retries
                }
            );
            this.eventHandler.queueEvent(TestEventsEnum.TEST_PASS, data);
        });

        runner.on('fail', (test: any, err: Error) => {
            this.failureCount++;
            const data = this.eventHandler.eventNormalizer.normalizeTestFail({
                    testId: test.testCaseId,
                    title: test.title,
                    error: err.message,
                    stack: err.stack || '',
                    testSuite: {
                        rabbitMqId: test.parent?.testSuiteId,
                        title: test.parent?.title
                    }
                }
            );

            this.eventHandler.queueEvent(TestEventsEnum.TEST_FAIL, data);
        });

        runner.on('suite end', (suite: any) => {
            if (!suite.title || suite.root) return;

            const hasFailed = suite.tests.some((t: any) => t.state === 'failed');
            const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
                suite.testSuiteId,
                suite.title,
                hasFailed
            );
            this.eventHandler.queueEvent(TestEventsEnum.SUITE_END, data);
        });

        runner.on('end', async () => {
            const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
            this.eventHandler.queueEvent(TestEventsEnum.RUN_END, data);

            // Serialize the event queue to pass to the child process
            const eventQueue = JSON.stringify(this.eventHandler.getEventQueue());

            // Spawn a new Node.js process to handle the event queue processing
            // We can thank Cypress for needing this super hacky workaround. 🙄
            // Cypress by default will kill the process after the test run is complete
            // before mocha processes have completed async operations
            // See: https://github.com/cypress-io/cypress/issues/7139
            const result = spawnSync('node', ['-e', `
                const { TestEventHandler } = require('@testpig/core');
                const eventQueue = ${eventQueue};
                const eventHandler = new TestEventHandler('${this.reporterOptions.projectId}', '${this.reporterOptions.runId}');
                eventHandler.setEventQueue(eventQueue);
                eventHandler.processEventQueue().then(() => {
                    process.exit(0);
                }).catch((error) => {
                    console.error('Failed to process event queue:', error);
                    process.exit(1);
                });
            `], {stdio: 'inherit'});

            if (result.error) {
                console.error('Failed to spawn child process:', result.error);
                process.exit(1);
            }

            process.exit(result.status);
        });
    }

    // runner.on('end', async () => {
    //     const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
    //     this.eventHandler.queueEvent(TestEventsEnum.RUN_END, data);
    //     await this.eventHandler.processEventQueue();
    // });
}

export = CypressReporter;