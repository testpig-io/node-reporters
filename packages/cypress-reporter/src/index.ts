import { TestEventHandler } from '@testpig/core';
import { v4 as uuidv4 } from 'uuid';

interface CypressReporterOptions {
    projectId?: string;
    runId?: string;
}

class CypressReporter {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;

    constructor(runner: any, options: { reporterOptions?: CypressReporterOptions } = {}) {
        const reporterOptions = options.reporterOptions || {};

        console.log("REPORTER OPTIONS: ", reporterOptions);

        if (!reporterOptions.projectId) {
            throw new Error('projectId is required in reporterOptions');
        }

        this.eventHandler = new TestEventHandler(reporterOptions.projectId, reporterOptions.runId);
        this.setupEventHandlers(runner);
    }

    private setupEventHandlers(runner: any) {
        runner.on('start', () => {
            const data = this.eventHandler.eventNormalizer.normalizeRunStart();
            this.eventHandler.queueEvent('start', data);
        });

        runner.on('suite', (suite: any) => {
            if (!suite.title || suite.root) return;

            const suiteId = uuidv4();
            suite.testSuiteId = suiteId;

            const data = this.eventHandler.eventNormalizer.normalizeSuiteStart(
                suiteId,
                suite.title,
                suite.file,
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
            this.eventHandler.queueEvent('suite', data);
        });

        runner.on('test', (test: any) => {
            const testId = uuidv4();
            test.testCaseId = testId;

            const data = this.eventHandler.eventNormalizer.normalizeTestStart(
                testId,
                test.title,
                test.file,
                test.body,
                {
                    rabbitMqId: test.parent?.testSuiteId,
                    title: test.parent?.title
                }
            );
            this.eventHandler.queueEvent('test', data);
        });

        runner.on('pass', (test: any) => {
            const data = this.eventHandler.eventNormalizer.normalizeTestPass(
                test.testCaseId,
                test.title,
                test.duration,
                {
                    rabbitMqId: test.parent?.testSuiteId,
                    title: test.parent?.title
                }
            );
            this.eventHandler.queueEvent('pass', data);
        });

        runner.on('fail', (test: any, err: Error) => {
            this.failureCount++;
            const data = this.eventHandler.eventNormalizer.normalizeTestFail(
                test.testCaseId,
                test.title,
                err.message,
                err.stack || '',
                test.duration,
                {
                    rabbitMqId: test.parent?.testSuiteId,
                    title: test.parent?.title
                }
            );
            this.eventHandler.queueEvent('fail', data);
        });

        runner.on('suite end', (suite: any) => {
            if (!suite.title || suite.root) return;

            const hasFailed = suite.tests.some((t: any) => t.state === 'failed');
            const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
                suite.testSuiteId,
                suite.title,
                hasFailed
            );
            this.eventHandler.queueEvent('suite end', data);
        });

        runner.on('end', () => {
            const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
            this.eventHandler.queueEvent('end', data);
            this.eventHandler.processEventQueue();
        });
    }
}

export = CypressReporter;