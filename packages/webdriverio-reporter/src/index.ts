import WDIOReporter from '@wdio/reporter';
import { TestBodyCache } from './test-body-cache';
import { BaseHandler } from './handlers/base-handler';
import { CucumberHandler } from './handlers/cucumber-handler';
import { StandardHandler } from './handlers/standard-handler';
import { createLogger } from '@testpig/shared';

export default class WebdriverIOReporter extends WDIOReporter {
    private handler: BaseHandler;
    private testBodyCache: TestBodyCache;
    private isCucumber: boolean = false;
    private logger = createLogger('WebdriverIOReporter');

    constructor(options: any) {
        super(options);

        const projectId = options?.projectId || process.env.TESTPIG_PROJECT_ID;
        const runId = options?.runId || process.env.TESTPIG_RUN_ID;

        if (!projectId) {
            throw new Error('projectId is required in reporter options or set in TESTPIG_PROJECT_ID environment variable');
        }

        this.logger.info(`Initialized with projectId: ${projectId}, runId: ${runId || 'not specified'}`);
        this.testBodyCache = new TestBodyCache();
        this.handler = this.createHandler(options);
    }

    private createHandler(options: any): BaseHandler {
        // We'll determine if it's Cucumber in onSuiteStart
        this.logger.debug('Creating initial handler (Standard)');
        return new StandardHandler(options, this.testBodyCache);
    }

    onRunnerStart(): void {
        this.logger.info('WebdriverIO test run starting');
        this.handler.handleRunStart();
    }

    onSuiteStart(suite: any): void {
        this.logger.debug(`Suite starting: ${suite.title}, type: ${suite.type}`);
        
        // Check if we need to switch to Cucumber handler
        if (!this.isCucumber && (suite.type === 'feature' || suite.type === 'scenario')) {
            this.logger.info('Detected Cucumber test framework, switching to Cucumber handler');
            this.isCucumber = true;
            this.handler = new CucumberHandler({
                projectId: (this.options as any).projectId || process.env.TESTPIG_PROJECT_ID,
                runId: (this.options as any).runId || process.env.TESTPIG_RUN_ID
            }, this.testBodyCache);

            // Call handleRunStart on the new handler
            this.handler.handleRunStart();
        }

        this.handler.handleSuiteStart(suite);
    }


    onTestStart(test: any): void {
        this.logger.debug(`Test starting: ${test.title}`);
        this.handler.handleTestStart(test);
    }

    onTestPass(test: any): void {
        this.logger.debug(`Test passed: ${test.title}, duration: ${test.duration}ms`);
        this.handler.handleTestPass(test);
    }

    onTestFail(test: any): void {
        this.logger.debug(`Test failed: ${test.title}`);
        if (test.error) {
            this.logger.debug(`Error: ${test.error.message}`);
        }
        this.handler.handleTestFail(test);
    }

    onSuiteEnd(suite: any): void {
        this.logger.debug(`Suite ending: ${suite.title}`);
        this.handler.handleSuiteEnd(suite);
    }

    onRunnerEnd(): void {
        this.logger.info('WebdriverIO test run ending, preparing to send results');
        this.handler.handleRunEnd();
        this.testBodyCache.clear();
        
        // Add a delay to ensure network requests have time to complete
        this.logger.info("Waiting for network requests to complete...");
        setTimeout(() => {
            this.logger.info("Network wait period complete");
        }, 2000);
    }
}