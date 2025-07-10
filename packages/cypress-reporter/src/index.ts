import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';
import {TestEventsEnum, createLogger, getSystemInfo } from "@testpig/shared";
import {spawnSync} from "node:child_process";

interface CypressReporterOptions {
    projectId?: string;
    runId?: string;
}

class CypressReporter {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private reporterOptions;
    private logger = createLogger('CypressReporter');

    constructor(runner: any, options: { reporterOptions?: CypressReporterOptions } = {}) {
        this.reporterOptions = options?.reporterOptions || {};
        const projectId = this.reporterOptions?.projectId || process.env.TESTPIG_PROJECT_ID;
        const runId = this.reporterOptions?.runId || process.env.TESTPIG_RUN_ID;
        if (!projectId) {
            throw new Error('projectId is required in reporterOptions or set in TESTPIG_PROJECT_ID environment variable');
        }

        this.eventHandler = new TestEventHandler(projectId, runId);
        this.logger.info(`Initialized with projectId: ${projectId}, runId: ${runId || 'not specified'}`);
        this.setupEventHandlers(runner);
    }

    private setupEventHandlers(runner: any) {
        runner.on('start', () => {
            this.logger.info('Cypress test run starting');
            const data = this.eventHandler.eventNormalizer.normalizeRunStart();
            this.eventHandler.queueEvent(TestEventsEnum.RUN_START, data);
        });

        runner.on('suite', (suite: any) => {
            if (!suite.title || suite.root) {
                this.logger.debug(`Ignoring root suite or suite with no title`);
                return;
            }

            const suiteId = uuidv4();
            suite.testSuiteId = suiteId;
            this.logger.debug(`Suite started: ${suite.title}, ID: ${suiteId}, file: ${suite.invocationDetails?.relativeFile}`);

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
                    frameworkVersion: require('cypress/package.json').version,
                    nodeVersion: getSystemInfo().nodeVersion,
                    npmVersion: getSystemInfo().npmVersion
                },
                'e2e'
            );
            this.eventHandler.queueEvent(TestEventsEnum.SUITE_START, data);
        });

        runner.on('test', (test: any) => {
            const testId = uuidv4();
            test.testCaseId = testId;
            this.logger.debug(`Test started: ${test.title}, ID: ${testId}, suite: ${test.parent?.title}`);

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
            this.logger.debug(`Test passed: ${test.title}, ID: ${test.testCaseId}, duration: ${test.duration}ms`);
            const data = this.eventHandler.eventNormalizer.normalizeTestPass({
                    testId: test.testCaseId,
                    title: test.title,
                    duration: Math.ceil(test.duration),
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
            this.logger.debug(`Test failed: ${test.title}, ID: ${test.testCaseId}`);
            this.logger.debug(`Error: ${err.message}`);
            
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
            if (!suite.title || suite.root) {
                this.logger.debug(`Ignoring end of root suite or suite with no title`);
                return;
            }

            const hasFailed = suite.tests.some((t: any) => t.state === 'failed');
            this.logger.debug(`Suite ended: ${suite.title}, ID: ${suite.testSuiteId}, hasFailed: ${hasFailed}`);
            
            const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
                suite.testSuiteId,
                suite.title,
                hasFailed
            );
            this.eventHandler.queueEvent(TestEventsEnum.SUITE_END, data);
        });

        runner.on('end', async () => {
            this.logger.info('Cypress test run ending, preparing to send results');
            const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
            this.eventHandler.queueEvent(TestEventsEnum.RUN_END, data);

            // Serialize the event queue to pass to the child process
            const eventQueue = JSON.stringify(this.eventHandler.getEventQueue());
            this.logger.info(`Spawning child process to handle ${this.eventHandler.getEventQueue().length} events`);

            // Spawn a new Node.js process to handle the event queue processing
            // We can thank Cypress for needing this super hacky workaround. 🙄
            // Cypress by default will kill the process after the test run is complete
            // before mocha processes have completed async operations
            // See: https://github.com/cypress-io/cypress/issues/7139
            const result = spawnSync('node', ['-e', `
                const { TestEventHandler } = require('@testpig/core');
                const { createLogger } = require('@testpig/shared');
                const logger = createLogger('CypressChildProcess');
                
                logger.info('Starting child process to process event queue');
                const eventQueue = ${eventQueue};
                logger.info(\`Processing \${eventQueue.length} events\`);
                
                const eventHandler = new TestEventHandler('${this.reporterOptions.projectId || process.env.TESTPIG_PROJECT_ID}', '${this.reporterOptions.runId || process.env.TESTPIG_RUN_ID}');
                eventHandler.setEventQueue(eventQueue);
                
                logger.info('Starting event processing');
                eventHandler.processEventQueue().then(() => {
                    logger.info('Successfully processed all events');
                    setTimeout(() => {
                        logger.info('Exiting child process after waiting for network requests');
                    }, 2000);
                }).catch((error) => {
                    logger.error('Failed to process event queue:', error);
                });
            `], {stdio: 'inherit'});

            if (result.error) {
                this.logger.error('Failed to spawn child process:', result.error);
            } else {
                this.logger.info('Child process completed');
            }
        });
    }
}

export = CypressReporter;