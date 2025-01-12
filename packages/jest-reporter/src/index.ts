import {Reporter, ReporterOnStartOptions, Test, TestContext, TestResult} from '@jest/reporters';
import {AggregatedResult} from '@jest/test-result';
import {Config} from '@jest/types';
import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';
import {TestBodyCache} from './test-body-cache';

class JestReporter implements Reporter {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private suiteMap = new Map<string, { id: string; title: string }>();
    private testBodyCache = new TestBodyCache();

    constructor(globalConfig: Config.GlobalConfig, options: { projectId?: string; runId?: string } = {}) {
        if (!options.projectId) {
            throw new Error('projectId is required in reporter options');
        }

        this.eventHandler = new TestEventHandler(options.projectId, options.runId);
    }

    onRunStart(): void {
        const data = this.eventHandler.eventNormalizer.normalizeRunStart();
        this.eventHandler.queueEvent('start', data);
    }

    onTestStart(test: Test): void {
        const suitePath = test.path;
        if (!this.suiteMap.has(suitePath)) {
            const suiteId = uuidv4();
            const suiteTitle = this.getSuiteTitle(test);

            this.suiteMap.set(suitePath, {id: suiteId, title: suiteTitle});

            const data = this.eventHandler.eventNormalizer.normalizeSuiteStart(
                suiteId,
                suiteTitle,
                suitePath,
                1,
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
    }

    onTestResult(test: Test, testResult: TestResult): void {
        const suite = this.suiteMap.get(test.path);
        if (!suite) return;

        testResult.testResults.forEach(result => {
            const testId = uuidv4();
            const testBody = this.testBodyCache.getTestBody(test.path, result.title);

            // Send test start event
            const startData = this.eventHandler.eventNormalizer.normalizeTestStart(
                testId,
                result.title,
                test.path,
                testBody,
                {
                    rabbitMqId: suite.id,
                    title: suite.title
                }
            );
            this.eventHandler.queueEvent('test', startData);

            if (result.status === 'passed') {
                const passData = this.eventHandler.eventNormalizer.normalizeTestPass({
                        testId,
                        title: result.title,
                        duration: result.duration || 0,
                        testSuite: {
                            rabbitMqId: suite.id,
                            title: suite.title
                        }
                    }
                );
                this.eventHandler.queueEvent('pass', passData);
            } else if (result.status === 'failed') {
                this.failureCount++;
                const stripAnsi = (str: string): string => {
                    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
                };
                // @ts-expect-error - matcherResult is not defined in the type
                const errorMessage = stripAnsi(result.failureDetails?.[0]?.matcherResult?.message || result.failureMessages.join('\n'));
                const stackTrace = stripAnsi(result.failureMessages.join('\n'));

                const failData = this.eventHandler.eventNormalizer.normalizeTestFail({
                    testId,
                    title: result.title,
                    error: errorMessage,
                    stack: stackTrace,
                    testSuite: {
                        rabbitMqId: suite.id,
                        title: suite.title
                    }
                });
                this.eventHandler.queueEvent('fail', failData);
            }
        });

        // Send suite end event
        const hasFailed = testResult.testResults.some(r => r.status === 'failed');
        const suiteEndData = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
            suite.id,
            suite.title,
            hasFailed
        );
        this.eventHandler.queueEvent('suite end', suiteEndData);
    }

    onRunComplete(): void {
        const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
        this.eventHandler.queueEvent('end', data);
        this.eventHandler.processEventQueue();

        // Clear the cache
        this.testBodyCache.clear();

        // Exit with appropriate code after a short delay to allow event queue processing
        setTimeout(() => {
            process.exit(this.failureCount > 0 ? 1 : 0);
        }, 100);

    }

    private getSuiteTitle(test: Test): string {
        const parts = test.path.split('/');
        return parts[parts.length - 1].replace(/\.[^/.]+$/, '');
    }

    getLastError(): Error | undefined {
        return undefined;
    }
}

export = JestReporter;