import WDIOReporter from '@wdio/reporter';
import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';
import fs from 'fs';

interface SuiteInfo {
    id: string;
    title: string;
    file: string;
    testCount: number;
}

class WebdriverIOReporter extends WDIOReporter {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private currentSuite: SuiteInfo | null = null;
    private testRunId: string;
    private pendingTests = new Map<string, { id: string; title: string }>();

    constructor(options: any) {
        // Ensure we pass the proper options structure to WDIOReporter
        super({
            ...options,
            stdout: true,
            outputDir: './'
        });

        if (!options.projectId) {
            throw new Error('projectId is required in reporter options');
        }

        this.testRunId = uuidv4();
        this.eventHandler = new TestEventHandler(options.projectId, options.runId || this.testRunId);
    }

    onRunnerStart(runner: any): void {
        const data = this.eventHandler.eventNormalizer.normalizeRunStart();
        this.eventHandler.queueEvent('start', data);
    }

    onSuiteStart(suite: any): void {
        console.log("STARTING THE SUITE!: ", suite);

        console.log("SUITE.TITLE: ", suite.title);
        console.log("SUITE.TYPE: ", suite.type);
        if (!suite.title || suite.type !== 'suite:start') return;

        console.log("MADE IT PAST THE IF STATEMENT!");
        console.log("CURRENTSUITE: ", this.currentSuite);

        // End previous suite if exists
        if (this.currentSuite) {
            this.endCurrentSuite(false);
        }

        const suiteId = uuidv4();
        console.log("GOT THE SUITE ID: ", suiteId);
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
        this.eventHandler.queueEvent('suite', data);
    }

    onTestStart(test: any): void {
        if (!this.currentSuite) return;

        const testId = uuidv4();
        this.pendingTests.set(test.uid, {id: testId, title: test.title});

        const data = this.eventHandler.eventNormalizer.normalizeTestStart(
            testId,
            test.title,
            test.file || this.currentSuite.file,
            test.body,
            {
                rabbitMqId: this.currentSuite.id,
                title: this.currentSuite.title
            }
        );
        this.eventHandler.queueEvent('test', data);
    }

    onTestPass(test: any): void {
        console.log("TEST CASE!: ", test);
        if (!this.currentSuite) return;

        const pendingTest = this.pendingTests.get(test.uid);
        if (!pendingTest) return;

        const data = this.eventHandler.eventNormalizer.normalizeTestPass(
            {
                testId: pendingTest.id,
                title: test.title,
                duration: test.duration || 0,
                testSuite: {
                    rabbitMqId: this.currentSuite.id,
                    title: this.currentSuite.title
                }
            }
        );
        this.eventHandler.queueEvent('pass', data);
        this.pendingTests.delete(test.uid);
    }

    onTestFail(test: any): void {
        if (!this.currentSuite) return;

        const pendingTest = this.pendingTests.get(test.uid);
        if (!pendingTest) return;

        this.failureCount++;
        const error = test.error || {};
        const data = this.eventHandler.eventNormalizer.normalizeTestFail(
            {
                testId: pendingTest.id,
                title: test.title,
                error: error.message || 'Test failed',
                stack: error.stack || '',
                testSuite: {
                    rabbitMqId: this.currentSuite.id,
                    title: this.currentSuite.title
                }
            }
        );
        this.eventHandler.queueEvent('fail', data);
        this.pendingTests.delete(test.uid);
    }

    onSuiteEnd(suite: any): void {
        if (!this.currentSuite || suite.type !== 'suite:end') return;
        this.endCurrentSuite(suite.tests?.some((t: any) => t.state === 'failed') || false);
    }

    onRunnerEnd(runner: any): void {
        // Ensure any remaining suite is ended
        if (this.currentSuite) {
            this.endCurrentSuite(false);
        }

        const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
        this.eventHandler.queueEvent('end', data);
        this.eventHandler.processEventQueue();
    }

    private endCurrentSuite(hasFailed: boolean): void {
        if (!this.currentSuite) return;

        const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
            this.currentSuite.id,
            this.currentSuite.title,
            hasFailed
        );
        this.eventHandler.queueEvent('suite end', data);
        this.currentSuite = null;
    }
}

export default WebdriverIOReporter;