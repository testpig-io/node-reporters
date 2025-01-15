import WDIOReporter from '@wdio/reporter';
import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';
import {TestBodyCache} from './test-body-cache';

interface SuiteInfo {
    id: string;
    title: string;
    file: string;
    testCount: number;
}

interface CucumberTestInfo {
    id: string;
    title: string;
    steps: string[];
    error?: string;
    stack?: string;
}

export default class WebdriverIOReporter extends WDIOReporter {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private currentSuite: SuiteInfo | null = null;
    private featureSuite: SuiteInfo | null = null;
    private testBodyCache = new TestBodyCache();
    private isCucumber: boolean = false;
    private currentCucumberTest: CucumberTestInfo | null = null;

    constructor(options: any) {
        super(options);

        if (!options.projectId) {
            throw new Error('projectId is required in reporter options');
        }

        this.eventHandler = new TestEventHandler(options.projectId, options.runId);
    }

    onRunnerStart(): void {
        const data = this.eventHandler.eventNormalizer.normalizeRunStart();
        this.eventHandler.queueEvent('start', data);
    }

    onSuiteStart(suite: any): void {
        console.log("IS CUCUMBER ON SUITE START? ", this.isCucumber);
        this.isCucumber = suite.type === 'feature' || suite.type === 'scenario';
        console.log("ONSUITESTART", suite);

        if (this.isCucumber) {
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
                        frameworkVersion: require('@wdio/reporter/package.json').version
                    },
                    'e2e'
                );
                this.eventHandler.queueEvent('suite', data);
            } else if (suite.type === 'scenario') {
                console.log("ONSUITESTART > SUITE.TYPE IS SCENARIO");
                // Start tracking a new scenario
                this.currentCucumberTest = {
                    id: uuidv4(),
                    title: suite.title,
                    steps: []
                };
            }
            return;
        }

        // Rest of the non-Cucumber suite handling remains the same
        if (!suite.title || suite.type !== 'suite') return;

        if (this.currentSuite) {
            this.endCurrentSuite(false);
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
        this.eventHandler.queueEvent('suite', data);
    }

    onTestStart(test: any): void {
        console.log("ON TEST START: ", test);
        console.log("ON TEST START > IS CUCUMBER ", this.isCucumber);
        if (this.isCucumber) {
            if (test.type === 'test') {
                // This is a step in a scenario
                this.currentCucumberTest?.steps.push(test.title);
                console.log("CURRENT CUCUMBER TEST: ", this.currentCucumberTest);
                return;
            }
            // Only process scenario-level tests
            if (test.type !== 'scenario' || !this.currentCucumberTest) return;

            const suite = this.featureSuite;
            if (!suite) return;

            const data = this.eventHandler.eventNormalizer.normalizeTestStart(
                this.currentCucumberTest.id,
                test.title,
                test.file || suite.file,
                this.currentCucumberTest.steps.join('\n'),
                {
                    rabbitMqId: suite.id,
                    title: suite.title
                }
            );
            this.eventHandler.queueEvent('test', data);
            test.testCaseId = this.currentCucumberTest.id;
            return;
        }

        // Non-Cucumber test handling
        const suite = this.currentSuite;
        if (!suite) return;

        const testId = uuidv4();
        const testBody = this.testBodyCache.getTestBody(test.file || suite.file, test.title);

        const data = this.eventHandler.eventNormalizer.normalizeTestStart(
            testId,
            test.title,
            test.file || suite.file,
            testBody,
            {
                rabbitMqId: suite.id,
                title: suite.title
            }
        );
        this.eventHandler.queueEvent('test', data);
        test.testCaseId = testId;
    }

    onTestPass(test: any): void {

        console.log("ON TEST PASS: ", test);
        if (this.isCucumber) {
            if (test.type !== 'scenario') return;
        }

        const suite = this.isCucumber ? this.featureSuite : this.currentSuite;
        if (!suite) return;

        const data = this.eventHandler.eventNormalizer.normalizeTestPass({
                testId: test.testCaseId,
                title: test.title,
                duration: test.duration,
                testSuite: {
                    rabbitMqId: suite.id,
                    title: suite.title
                }
            }
        );
        this.eventHandler.queueEvent('pass', data);
    }

    onTestFail(test: any): void {
        console.log("ON TEST FAIL: ", test);
        if (this.isCucumber) {
            if (this.currentCucumberTest) {
                this.currentCucumberTest.error = test.error?.message || 'Test failed';
                this.currentCucumberTest.stack = test.error?.stack || '';
            }
            if (test.type !== 'scenario') return;
        }

        const suite = this.isCucumber ? this.featureSuite : this.currentSuite;
        if (!suite) return;

        this.failureCount++;
        const data = this.eventHandler.eventNormalizer.normalizeTestFail({
                testId: test.testCaseId,
                title: test.title,
                error: test.error?.message || 'Test failed',
                stack: test.error?.stack || '',
                testSuite: {
                    rabbitMqId: suite.id,
                    title: suite.title
                }
            }
        );
        this.eventHandler.queueEvent('fail', data);
    }

    onSuiteEnd(suite: any): void {
        console.log("ONSUITEEND: ", suite);
        if (this.isCucumber) {
            if (suite.type === 'scenario') {
                console.log("ON SUITE END CURRENT CUCUMBER TEST: ", this.currentCucumberTest);
                // send a test start and end event for the scenario
                const data = this.eventHandler.eventNormalizer.normalizeTestStart(
                    this.currentCucumberTest?.id || uuidv4(),
                    suite.title,
                    suite.file || 'unknown',
                    this.currentCucumberTest?.steps.join('\n') || '',
                    {
                        rabbitMqId: this.featureSuite?.id || 'unknown',
                        title: this.featureSuite?.title || 'unknown'
                    }
                );

                this.eventHandler.queueEvent('test', data);

                const hasFailed = suite.tests?.some((t: any) => t.state === 'failed') || false;

                if (hasFailed) {
                    this.failureCount++;
                    const data = this.eventHandler.eventNormalizer.normalizeTestFail({
                            testId: this.currentCucumberTest?.id || uuidv4(),
                            title: suite.title,
                            error: this.currentCucumberTest?.error || 'Test failed',
                            stack: this.currentCucumberTest?.stack || '',
                            testSuite: {
                                rabbitMqId: this.featureSuite?.id || 'unknown',
                                title: this.featureSuite?.title || 'unknown'
                            }
                        }
                    );

                    this.eventHandler.queueEvent('fail', data);
                } else {
                    const data2 = this.eventHandler.eventNormalizer.normalizeTestPass({
                            testId: this.currentCucumberTest?.id || uuidv4(),
                            title: suite.title,
                            duration: suite.duration,
                            testSuite: {
                                rabbitMqId: this.featureSuite?.id || 'unknown',
                                title: this.featureSuite?.title || 'unknown'
                            }
                        }
                    );

                    this.eventHandler.queueEvent('pass', data2);

                    this.currentCucumberTest = null;
                }

            } else if (suite.type === 'feature') {
                this.endCurrentSuite(suite.tests?.some((t: any) => t.state === 'failed') || false);
                this.featureSuite = null;
            }
            return;
        }

        if (!suite.title || suite.type !== 'suite') return;
        this.endCurrentSuite(suite.tests?.some((t: any) => t.state === 'failed') || false);
    }

    onRunnerEnd(): void {
        if (this.currentSuite) {
            this.endCurrentSuite(false);
        }

        const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
        this.eventHandler.queueEvent('end', data);
        this.eventHandler.processEventQueue();
        this.testBodyCache.clear();
    }

    private endCurrentSuite(hasFailed: boolean): void {
        const suite = this.isCucumber ? this.featureSuite : this.currentSuite;
        if (!suite) return;

        const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
            suite.id,
            suite.title,
            hasFailed
        );
        this.eventHandler.queueEvent('suite end', data);
        this.currentSuite = null;
    }
}