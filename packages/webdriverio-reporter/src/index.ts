import WDIOReporter from '@wdio/reporter';
import { TestBodyCache } from './test-body-cache';
import { BaseHandler } from './handlers/base-handler';
import { CucumberHandler } from './handlers/cucumber-handler';
import { StandardHandler } from './handlers/standard-handler';

export default class WebdriverIOReporter extends WDIOReporter {
    private handler: BaseHandler;
    private testBodyCache: TestBodyCache;
    private isCucumber: boolean = false;

    constructor(options: any) {
        super(options);

        if (!options.projectId) {
            throw new Error('projectId is required in reporter options');
        }

        this.testBodyCache = new TestBodyCache();
        this.handler = this.createHandler(options);
    }

    private createHandler(options: any): BaseHandler {
        // We'll determine if it's Cucumber in onSuiteStart
        return new StandardHandler(options, this.testBodyCache);
    }

    onRunnerStart(): void {
        this.handler.handleRunStart();
    }

    onSuiteStart(suite: any): void {
        // Check if we need to switch to Cucumber handler
        if (!this.isCucumber && (suite.type === 'feature' || suite.type === 'scenario')) {
            this.isCucumber = true;
            this.handler = new CucumberHandler({
                projectId: (this.options as any).projectId,
                runId: (this.options as any).runId
            }, this.testBodyCache);

            // Call handleRunStart on the new handler
            this.handler.handleRunStart();
        }

        this.handler.handleSuiteStart(suite);
    }


    onTestStart(test: any): void {
        console.log("REACHED WEBDRIVERIO REPORTER > onTestStart");
        this.handler.handleTestStart(test);
    }

    onTestPass(test: any): void {
        console.log("REACHED WEBDRIVERIO REPORTER > onTestPass");
        this.handler.handleTestPass(test);
    }

    onTestFail(test: any): void {
        this.handler.handleTestFail(test);
    }

    onSuiteEnd(suite: any): void {
        this.handler.handleSuiteEnd(suite);
    }

    onRunnerEnd(): void {
        this.handler.handleRunEnd();
        this.testBodyCache.clear();
    }
}