import { v4 as uuidv4 } from 'uuid';
import { TestEventHandler } from '@testpig/core';
import { BaseHandler, SuiteInfo, TestHandlerConfig } from './base-handler';
import { TestBodyCache } from '../test-body-cache';
import {TestEventsEnum} from "@testpig/shared";

export class StandardHandler implements BaseHandler {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private currentSuite: SuiteInfo | null = null;
    private testBodyCache: TestBodyCache;

    constructor(config: TestHandlerConfig, testBodyCache: TestBodyCache) {
        this.eventHandler = new TestEventHandler(config.projectId, config.runId);
        this.testBodyCache = testBodyCache;
    }

    handleRunStart(): void {
        const data = this.eventHandler.eventNormalizer.normalizeRunStart();
        this.eventHandler.queueEvent(TestEventsEnum.RUN_START, data);
    }

    handleSuiteStart(suite: any): void {
        const suiteStartNames = ['suite', 'suite:start'];
        if (!suite.title || !suiteStartNames.some(suiteStatName => suiteStatName === suite.type)) return;

        if (this.currentSuite) {
            this.handleSuiteEnd(this.currentSuite);
        }

        if (suite.file) {
            this.testBodyCache.cacheTestBodies(suite.file);
        }

        const suiteId = uuidv4();
        this.currentSuite = {
            id: suiteId,
            title: suite.title,
            file: suite.file || 'unknown',
            testCount: suite.tests?.length || 0
        };

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
                frameworkVersion: require('@wdio/reporter/package.json').version
            },
            'e2e'
        );

        this.eventHandler.queueEvent(TestEventsEnum.SUITE_START, data);
    }

    handleTestStart(test: any): void {
        if (!this.currentSuite) return;

        const testId = uuidv4();
        const testBody = test.body ? test.body : this.testBodyCache.getTestBody(test.file || this.currentSuite.file, test.title);

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
        if (!this.currentSuite) return;

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
        if (!this.currentSuite) return;

        this.failureCount++;
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
        if (!this.currentSuite) return;

        const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
            this.currentSuite.id,
            this.currentSuite.title,
            suite.tests?.some((t: any) => t.state === 'failed') || false
        );
        this.eventHandler.queueEvent(TestEventsEnum.SUITE_END, data);
        this.currentSuite = null;
    }

    handleRunEnd(): void {
        if (this.currentSuite) {
            this.handleSuiteEnd(this.currentSuite);
        }

        const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
        this.eventHandler.queueEvent(TestEventsEnum.RUN_END, data);
        this.eventHandler.processEventQueue();
    }
}