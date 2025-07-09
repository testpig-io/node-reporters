import { v4 as uuidv4 } from 'uuid';
import { TestEventHandler } from '@testpig/core';
import { BaseHandler, SuiteInfo, TestHandlerConfig } from './base-handler';
import { TestBodyCache } from '../test-body-cache';
import { TestEventsEnum, createLogger, getSystemInfo } from "@testpig/shared";

export class StandardHandler implements BaseHandler {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private currentSuite: SuiteInfo | null = null;
    private testBodyCache: TestBodyCache;
    private logger = createLogger('StandardHandler');

    constructor(config: TestHandlerConfig, testBodyCache: TestBodyCache) {
        this.eventHandler = new TestEventHandler(config.projectId, config.runId);
        this.testBodyCache = testBodyCache;
        this.logger.info(`Initialized with projectId: ${config.projectId}, runId: ${config.runId || 'not specified'}`);
    }

    handleRunStart(): void {
        this.logger.info('Standard test run starting');
        const data = this.eventHandler.eventNormalizer.normalizeRunStart();
        this.eventHandler.queueEvent(TestEventsEnum.RUN_START, data);
    }

    handleSuiteStart(suite: any): void {
        const suiteStartNames = ['suite', 'suite:start'];
        if (!suite.title || !suiteStartNames.some(suiteStatName => suiteStatName === suite.type)) {
            this.logger.debug(`Ignoring suite event with type ${suite.type} or empty title`);
            return;
        }

        if (this.currentSuite) {
            this.logger.debug(`Found existing suite ${this.currentSuite.title}, ending it before starting new suite`);
            this.handleSuiteEnd(this.currentSuite);
        }

        if (suite.file) {
            this.logger.debug(`Caching test bodies for file: ${suite.file}`);
            this.testBodyCache.cacheTestBodies(suite.file);
        }

        const suiteId = uuidv4();
        this.currentSuite = {
            id: suiteId,
            title: suite.title,
            file: suite.file || 'unknown',
            testCount: suite.tests?.length || 0
        };
        this.logger.debug(`Suite started: ${suite.title}, ID: ${suiteId}, testCount: ${this.currentSuite.testCount}`);

        const data = this.eventHandler.eventNormalizer.normalizeSuiteStart(
            suiteId,
            suite.title,
            suite.file || 'unknown',
            this.currentSuite.testCount,
            {
                os: process.platform,
                architecture: process.arch,
                // @ts-expect-error browser is not defined in the capabilities type
                browser: (browser?.capabilities?.browserName as string) || 'unknown',
                framework: 'WebdriverIO',
                frameworkVersion: require('@wdio/reporter/package.json').version,
                nodeVersion: getSystemInfo().nodeVersion,
                npmVersion: getSystemInfo().npmVersion
            },
            'e2e'
        );

        this.eventHandler.queueEvent(TestEventsEnum.SUITE_START, data);
    }

    handleTestStart(test: any): void {
        if (!this.currentSuite) {
            this.logger.warn(`Test start event received but no current suite exists: ${test.title}`);
            return;
        }

        const testId = uuidv4();
        const testBody = test.body ? test.body : this.testBodyCache.getTestBody(test.file || this.currentSuite.file, test.title);
        this.logger.debug(`Test started: ${test.title}, ID: ${testId}, suite: ${this.currentSuite.title}`);

        const data = this.eventHandler.eventNormalizer.normalizeTestStart(
            testId,
            test.title,
            test.file || this.currentSuite.file,
            testBody,
            {
                rabbitMqId: this.currentSuite.id,
                title: this.currentSuite.title
            }
        );
        this.eventHandler.queueEvent(TestEventsEnum.TEST_START, data);
        test.testCaseId = testId;
    }

    handleTestPass(test: any): void {
        if (!this.currentSuite) {
            this.logger.warn(`Test pass event received but no current suite exists: ${test.title}`);
            return;
        }

        this.logger.debug(`Test passed: ${test.title}, ID: ${test.testCaseId}, duration: ${test.duration}ms`);
        const data = this.eventHandler.eventNormalizer.normalizeTestPass({
            testId: test.testCaseId,
            title: test.title,
            duration: test.duration,
            testSuite: {
                rabbitMqId: this.currentSuite.id,
                title: this.currentSuite.title
            }
        });
        this.eventHandler.queueEvent(TestEventsEnum.TEST_PASS, data);
    }

    handleTestFail(test: any): void {
        if (!this.currentSuite) {
            this.logger.warn(`Test fail event received but no current suite exists: ${test.title}`);
            return;
        }

        this.failureCount++;
        this.logger.debug(`Test failed: ${test.title}, ID: ${test.testCaseId}`);
        if (test.error?.message) {
            this.logger.debug(`Error: ${test.error.message}`);
        }
        
        const data = this.eventHandler.eventNormalizer.normalizeTestFail({
            testId: test.testCaseId,
            title: test.title,
            error: test.error?.message || 'Test failed',
            stack: test.error?.stack || '',
            testSuite: {
                rabbitMqId: this.currentSuite.id,
                title: this.currentSuite.title
            }
        });
        this.eventHandler.queueEvent(TestEventsEnum.TEST_FAIL, data);
    }

    handleSuiteEnd(suite: any): void {
        if (!this.currentSuite) {
            this.logger.warn(`Suite end event received but no current suite exists`);
            return;
        }

        this.logger.debug(`Suite ended: ${this.currentSuite.title}, ID: ${this.currentSuite.id}`);
        const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
            this.currentSuite.id,
            this.currentSuite.title,
            suite.tests?.some((t: any) => t.state === 'failed') || false
        );
        this.eventHandler.queueEvent(TestEventsEnum.SUITE_END, data);
        this.currentSuite = null;
    }

    async handleRunEnd(): Promise<void> {
        if (this.currentSuite) {
            this.logger.debug(`Closing current suite at run end: ${this.currentSuite.title}`);
            this.handleSuiteEnd(this.currentSuite);
        }

        this.logger.info('Standard test run ending, preparing to send results');
        const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
        this.eventHandler.queueEvent(TestEventsEnum.RUN_END, data);
        
        try {
            // Process the event queue and wait for it to complete
            await this.eventHandler.processEventQueue();
            
            // Add a delay to ensure network requests have time to complete
            this.logger.info("Waiting for network requests to complete...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.logger.info("Network wait period complete");
        } catch (error) {
            this.logger.error("Error processing event queue:", error);
        }
    }
}