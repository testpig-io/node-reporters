import { v4 as uuidv4 } from 'uuid';
import { TestEventHandler } from '@testpig/core';
import { BaseHandler, SuiteInfo, TestHandlerConfig } from './base-handler';
import { TestBodyCache } from '../test-body-cache';
import {TestEventsEnum, getSystemInfo} from "@testpig/shared";

interface CucumberTestInfo {
    id: string;
    title: string;
    steps: string[];
    error?: string;
    stack?: string;
}

export class CucumberHandler implements BaseHandler {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private featureSuite: SuiteInfo | null = null;
    private currentTest: CucumberTestInfo | null = null;
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
        if (suite.type === 'feature') {
            if (suite.file) {
                this.testBodyCache.cacheTestBodies(suite.file);
            }

            const suiteId = uuidv4();
            this.featureSuite = {
                id: suiteId,
                title: suite.title,
                file: suite.file || 'unknown',
                testCount: suite.tests?.length || 0
            };

            const data = this.eventHandler.eventNormalizer.normalizeSuiteStart(
                suiteId,
                suite.title,
                suite.file || 'unknown',
                this.featureSuite.testCount,
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
        } else if (suite.type === 'scenario') {
            this.currentTest = {
                id: uuidv4(),
                title: suite.title,
                steps: []
            };
        }
    }

    handleTestStart(test: any): void {
        if (test.type === 'test') {
            // This is a step in a scenario
            this.currentTest?.steps.push(test.title);
            return;
        }
    }

    handleTestPass(test: any): void {
        // do nothing here - we handle this in handleSuiteEnd
    }

    handleTestFail(test: any): void {
        if (this.currentTest) {
            this.currentTest.error = test.error?.message || 'Test failed';
            this.currentTest.stack = test.error?.stack || '';
        }
        if (test.type !== 'scenario' || !this.featureSuite) return;

        this.failureCount++;

        // do nothing here - we handle this in handleSuiteEnd
    }

    handleSuiteEnd(suite: any): void {
        if (suite.type === 'scenario') {
            // Only process scenario-level tests
            if (!this.currentTest || !this.featureSuite) return;

            const data = this.eventHandler.eventNormalizer.normalizeTestStart(
                this.currentTest.id,
                this.currentTest.title,
                suite.file || this.featureSuite.file,
                this.currentTest.steps.join('\n'),
                {
                    rabbitMqId: this.featureSuite.id,
                    title: this.featureSuite.title
                }
            );
            this.eventHandler.queueEvent(TestEventsEnum.TEST_START, data);

            // process whether the test passed or failed
            if (this.currentTest.error) {
                this.failureCount++;
                const failData = this.eventHandler.eventNormalizer.normalizeTestFail({
                    testId: this.currentTest.id,
                    title: this.currentTest.title,
                    error: this.currentTest.error,
                    stack: this.currentTest.stack || '',
                    testSuite: {
                        rabbitMqId: this.featureSuite.id,
                        title: this.featureSuite.title
                    }
                });
                this.eventHandler.queueEvent(TestEventsEnum.TEST_FAIL, failData);
            } else {
                const passData = this.eventHandler.eventNormalizer.normalizeTestPass({
                    testId: this.currentTest.id,
                    title: this.currentTest.title,
                    duration: 0,
                    testSuite: {
                        rabbitMqId: this.featureSuite.id,
                        title: this.featureSuite.title
                    }
                });
                this.eventHandler.queueEvent(TestEventsEnum.TEST_PASS, passData);
            }

            this.currentTest = null;
        } else if (suite.type === 'feature' && this.featureSuite) {
            const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
                this.featureSuite.id,
                this.featureSuite.title,
                suite.tests?.some((t: any) => t.state === 'failed') || false
            );
            this.eventHandler.queueEvent(TestEventsEnum.SUITE_END, data);
            this.featureSuite = null;
        }
    }

    handleRunEnd(): void {
        const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
        this.eventHandler.queueEvent(TestEventsEnum.RUN_END, data);
        this.eventHandler.processEventQueue();
    }
}