import {Formatter, IFormatterOptions} from '@cucumber/cucumber';
import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';
import {TestStatus} from "@testpig/shared";

interface SuiteInfo {
    id: string;
    title: string;
    file: string;
    testCount: number;
}

interface ScenarioInfo {
    id: string;
    title: string;
    steps: { title: string, status: string }[];
    error?: string;
    stack?: string;
    status?: string;
    startTime?: number;
    endTime?: number;
}

export default class CucumberReporter extends Formatter {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private currentFeature: SuiteInfo | null = null;
    private currentScenario: ScenarioInfo | null = null;
    private finishPromise: Promise<void>;
    private resolveFinish!: () => void;

    constructor(options: IFormatterOptions) {
        super(options);
        const formatterOptions = options.parsedArgvOptions?.testpig || {};

        if (!formatterOptions.projectId) {
            throw new Error('projectId is required in formatOptions.testpig');
        }

        this.eventHandler = new TestEventHandler(
            formatterOptions.projectId,
            formatterOptions.runId
        );

        // Initialize finish promise
        this.finishPromise = new Promise((resolve) => {
            this.resolveFinish = resolve;
        });

        // Register event handlers
        options.eventBroadcaster.on('envelope', this.processEnvelope.bind(this));
    }

    private processEnvelope(envelope: any): void {
        console.log("PROCESS ENVELOPE TYPE:", envelope.gherkinDocument ? 'gherkinDocument' :
            envelope.pickle ? 'pickle' :
                envelope.testRunStarted ? 'testRunStarted' :
                    envelope.testCaseStarted ? 'testCaseStarted' :
                        envelope.testStepStarted ? 'testStepStarted' :
                            envelope.testStepFinished ? 'testStepFinished' :
                                envelope.testCaseFinished ? 'testCaseFinished' :
                                    envelope.testRunFinished ? 'testRunFinished' : 'unknown');

        // Handle Feature (Suite) start
        if (envelope.gherkinDocument?.feature) {
            this.handleFeatureStart(envelope.gherkinDocument);
        }

        // Handle Scenario (Test) start
        if (envelope.pickle) {
            this.handleScenarioStart(envelope.pickle);
        }

        // Handle test run events
        if (envelope.testRunStarted) {
            this.onTestRunStarted();
        } else if (envelope.testStepStarted) {
            this.onTestStepStarted(envelope.testStepStarted);
        } else if (envelope.testStepFinished) {
            this.onTestStepFinished(envelope.testStepFinished);
        } else if (envelope.testCaseFinished) {
            this.onTestCaseFinished(envelope.testCaseFinished);
        } else if (envelope.testRunFinished) {
            this.onTestRunFinished();
        }
    }

    private handleFeatureStart(gherkinDocument: any): void {
        const feature = gherkinDocument.feature;

        // End previous feature if exists
        if (this.currentFeature) {
            const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
                this.currentFeature.id,
                this.currentFeature.title,
                false
            );
            this.eventHandler.queueEvent('suite end', data);
        }

        const suiteId = uuidv4();
        this.currentFeature = {
            id: suiteId,
            title: feature.name,
            file: gherkinDocument.uri,
            testCount: feature.children.length
        };

        const data = this.eventHandler.eventNormalizer.normalizeSuiteStart(
            suiteId,
            feature.name,
            gherkinDocument.uri,
            this.currentFeature.testCount,
            {
                os: process.platform,
                architecture: process.arch,
                browser: 'Node.js',
                framework: 'Cucumber.js',
                frameworkVersion: require('@cucumber/cucumber/package.json').version
            },
            'e2e'
        );
        this.eventHandler.queueEvent('suite', data);
    }

    private handleScenarioStart(pickle: any): void {
        console.log("PICKLE ON START: ", pickle);
        if (!this.currentFeature) return;

        this.currentScenario = {
            id: uuidv4(),
            title: pickle.name,
            steps: pickle.steps.map((step: any) => step.text),
            status: TestStatus.PENDING,
            startTime: new Date().getTime()
        };

        const data = this.eventHandler.eventNormalizer.normalizeTestStart(
            this.currentScenario.id,
            pickle.name,
            this.currentFeature.file,
            this.currentScenario.steps.join('\n'),
            {
                rabbitMqId: this.currentFeature.id,
                title: this.currentFeature.title
            }
        );
        this.eventHandler.queueEvent('test', data);
    }

    private onTestRunStarted(): void {
        console.log("ON TEST RUN STARTED");
        const data = this.eventHandler.eventNormalizer.normalizeRunStart();
        this.eventHandler.queueEvent('start', data);
    }

    private onTestStepStarted(testStepStarted: any): void {
        console.log("ON TEST STEP STARTED");
        // We already have the steps from the pickle
    }

    private onTestStepFinished(testStepFinished: any): void {
        console.log("ON TEST STEP FINISHED", testStepFinished);
        if (!this.currentScenario) return;

        const {testStepResult} = testStepFinished;
        if (testStepResult.status === 'FAILED') {
            this.currentScenario.error = testStepResult.message;
            this.currentScenario.stack = testStepResult.exception?.stack || '';
            this.currentScenario.status = TestStatus.FAILED;
        }
    }

    private onTestCaseFinished(testCaseFinished: any): void {
        console.log("TEST CASE FINISHED: ", testCaseFinished);
        if (!this.currentScenario || !this.currentFeature) return;

        this.currentScenario.endTime = new Date().getTime();

        // set status to pass if no status is set
        if (!this.currentScenario.status) {
            this.currentScenario.status = TestStatus.PASSED;
        }

        const {testCaseResult} = testCaseFinished;

        if (this.currentScenario.status === 'FAILED') {
            this.failureCount++;
            const data = this.eventHandler.eventNormalizer.normalizeTestFail({
                    testId: this.currentScenario.id,
                    title: this.currentScenario.title,
                    error: this.currentScenario.error || 'Test failed',
                    stack: this.currentScenario.stack || '',
                    testSuite: {
                        rabbitMqId: this.currentFeature.id,
                        title: this.currentFeature.title
                    }
                }
            );
            this.eventHandler.queueEvent('fail', data);
        } else {
            const data = this.eventHandler.eventNormalizer.normalizeTestPass({
                    testId: this.currentScenario.id,
                    title: this.currentScenario.title,
                    duration: this.currentScenario.startTime ? this.currentScenario.endTime - this.currentScenario.startTime : 0,
                    testSuite: {
                        rabbitMqId: this.currentFeature.id,
                        title: this.currentFeature.title
                    }
                }
            );
            this.eventHandler.queueEvent('pass', data);
        }

        this.currentScenario = null;
    }

    private async onTestRunFinished(): Promise<void> {
        console.log("ON TEST RUN FINISHED");
        if (this.currentFeature) {
            const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
                this.currentFeature.id,
                this.currentFeature.title,
                false
            );
            this.eventHandler.queueEvent('suite end', data);
            this.currentFeature = null;
        }

        const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
        this.eventHandler.queueEvent('end', data);

        try {
            await this.eventHandler.processEventQueue();
        } catch (error) {
            console.error('Failed to process event queue:', error);
        }

        this.resolveFinish();
    }

    // Required method for Cucumber formatters
    public async finished(): Promise<void> {
        return this.finishPromise;
    }
}