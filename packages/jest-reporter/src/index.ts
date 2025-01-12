import {Reporter, ReporterOnStartOptions, Test, TestContext, TestResult} from '@jest/reporters';
import {AggregatedResult} from '@jest/test-result';
import {Config} from '@jest/types';
import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';

interface SuiteInfo {
    id: string;
    name: string;
    path: string;
}

class JestReporter implements Reporter {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private currentSuite: SuiteInfo | null = null;

    constructor(globalConfig: Config.GlobalConfig, options: { projectId?: string; runId?: string } = {}) {
        if (!options.projectId) {
            throw new Error('projectId is required in reporter options');
        }

        this.eventHandler = new TestEventHandler(options.projectId, options.runId);
    }

    onRunStart(results: AggregatedResult, options: ReporterOnStartOptions): void {
        const data = this.eventHandler.eventNormalizer.normalizeRunStart();
        this.eventHandler.queueEvent('start', data);
    }

    onTestStart(test: Test): void {
        // Extract suite information from the test path
        const suitePath = test.path;
        const suiteName = this.getSuiteName(test);

        // Handle suite start if it's a new suite
        if (!this.currentSuite || this.currentSuite.path !== suitePath || this.currentSuite.name !== suiteName) {
            if (this.currentSuite) {
                // End previous suite if exists
                this.onSuiteEnd(this.currentSuite, false);
            }

            const suiteId = uuidv4();
            this.currentSuite = {
                id: suiteId,
                name: suiteName,
                path: suitePath
            };

            const data = this.eventHandler.eventNormalizer.normalizeSuiteStart(
                suiteId,
                suiteName,
                suitePath,
                1, // We don't have access to the total test count here
                {
                    os: process.platform,
                    architecture: process.arch,
                    browser: 'Node.js',
                    framework: 'Jest',
                    frameworkVersion: require('jest/package.json').version
                },
                'unit'
            );
            this.eventHandler.queueEvent('suite', data);
        }

        // We'll store test IDs when we get the results
    }

    onTestResult(test: Test, testResult: TestResult): void {
        testResult.testResults.forEach(result => {
            // Create a new UUID for each test result
            const testId = uuidv4();

            console.log("TEST OBJECT: ", test);
            console.log("TEST RESULT: ", testResult);

            if (result.status === 'passed') {
                const data = this.eventHandler.eventNormalizer.normalizeTestStart(
                    testId,
                    result.title,
                    test.path,
                    '', // Jest doesn't provide direct access to test body
                    {
                        rabbitMqId: this.currentSuite?.id,
                        title: this.currentSuite?.name
                    }
                );
                this.eventHandler.queueEvent('test', data);

                const passData = this.eventHandler.eventNormalizer.normalizeTestPass({
                        testId,
                        title: result.title,
                        duration: result.duration || 0,
                        testSuite: {
                            rabbitMqId: this.currentSuite?.id,
                            title: this.currentSuite?.name
                        }
                    }
                );
                this.eventHandler.queueEvent('pass', passData);
            } else if (result.status === 'failed') {
                this.failureCount++;

                const data = this.eventHandler.eventNormalizer.normalizeTestStart(
                    testId,
                    result.title,
                    test.path,
                    '', // Jest doesn't provide direct access to test body
                    {
                        rabbitMqId: this.currentSuite?.id,
                        title: this.currentSuite?.name
                    }
                );
                this.eventHandler.queueEvent('test', data);

                const failData = this.eventHandler.eventNormalizer.normalizeTestFail(
                    {
                        testId,
                        title: result.title,
                        error: result.failureMessages.join('\n'),
                        stack: '',
                        // stack: result.failureDetails?.[0]?.stack || '',
                        testSuite: {
                            rabbitMqId: this.currentSuite?.id,
                            title: this.currentSuite?.name
                        }
                    }
                );
                this.eventHandler.queueEvent('fail', failData);
            }
        });
    }

    onRunComplete(contexts: Set<TestContext>, results: AggregatedResult): void {
        // End the last suite if exists
        if (this.currentSuite) {
            this.onSuiteEnd(this.currentSuite, this.failureCount > 0);
        }

        const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
        this.eventHandler.queueEvent('end', data);
        this.eventHandler.processEventQueue();
    }

    private onSuiteEnd(suite: SuiteInfo, hasFailed: boolean): void {
        const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
            suite.id,
            suite.name,
            hasFailed
        );
        this.eventHandler.queueEvent('suite end', data);
        this.currentSuite = null;
    }

    private getSuiteName(test: Test): string {
        // Extract the file name without extension as the suite name
        const parts = test.path.split('/');
        return parts[parts.length - 1].replace(/\.[^/.]+$/, '');
    }

    getLastError(): Error | undefined {
        return undefined;
    }
}

export = JestReporter;