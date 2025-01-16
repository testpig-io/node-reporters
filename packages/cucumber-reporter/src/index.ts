import {Formatter, IFormatterOptions} from '@cucumber/cucumber';
import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';

interface SuiteInfo {
    id: string;
    title: string;
    file: string;
    testCount: number;
}

interface ScenarioInfo {
    id: string;
    title: string;
    steps: string[];
    error?: string;
    stack?: string;
}

interface TestCaseMap {
    gherkinDocument: any;
    pickle: any;
}

export default class CucumberReporter extends Formatter {
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private currentFeature: SuiteInfo | null = null;
    private currentScenario: ScenarioInfo | null = null;
    private finishPromise: Promise<void>;
    private resolveFinish!: () => void;
    private testCaseMap = new Map<string, TestCaseMap>();

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

        console.log("EVENT HANDLER: ", this.eventHandler);

        // Initialize finish promise
        this.finishPromise = new Promise((resolve) => {
            this.resolveFinish = resolve;
        });

        // Register event handlers
        options.eventBroadcaster.on('envelope', this.processEnvelope.bind(this));
    }

    private processEnvelope(envelope: any): void {
        // console.log("PROCESS ENVELOPE: ", envelope);
        // Store gherkin document and pickle information
        if (envelope.gherkinDocument) {
            this.processGherkinDocument(envelope.gherkinDocument);
        }
        if (envelope.pickle) {
            this.processPickle(envelope.pickle);
        }

        // Process test events
        if (envelope.testRunStarted) {
            this.onTestRunStarted();
        } else if (envelope.testCaseStarted) {
            this.onTestCaseStarted(envelope.testCaseStarted);
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

    private processGherkinDocument(gherkinDocument: any): void {
        // console.log("PROCESS GHERKIN DOCUMENT: ", gherkinDocument);
        // Store gherkin document for each scenario
        if (gherkinDocument.feature) {
            gherkinDocument.feature.children.forEach((child: any) => {
                if (child.scenario) {
                    const testCaseInfo = this.testCaseMap.get(child.scenario.id) || {};
                    console.log("CHILD.SCENARIO: ", child.scenario);
                    console.log("TESTCASEINFO: ", testCaseInfo);
                    // @ts-ignore
                    this.testCaseMap.set(child.scenario.id, {
                        ...testCaseInfo,
                        gherkinDocument
                    });
                }
            });
        }
    }

    private processPickle(pickle: any): void {
        // console.log("PROCESS PICKLE: ", pickle);
        // Store pickle for the scenario
        const testCaseInfo = this.testCaseMap.get(pickle.astNodeIds[0]) || {};
        console.log("PROCESSPICKLE > TESTCASEINFO: ", testCaseInfo);
        // @ts-ignore
        this.testCaseMap.set(pickle.astNodeIds[0], {
            ...testCaseInfo,
            pickle
        });
    }

    private onTestRunStarted(): void {
        console.log("ON TEST RUN STARTED");
        const data = this.eventHandler.eventNormalizer.normalizeRunStart();
        this.eventHandler.queueEvent('start', data);
    }

    private onTestCaseStarted(testCaseStarted: any): void {
        console.log("ON TEST CASE STARTED: ", testCaseStarted);
        const testCaseInfo = this.testCaseMap.get(testCaseStarted.id);

        // get all items from testCaseMap
        console.log("TEST CASE MAP: ", this.testCaseMap);
        // if (!testCaseInfo) return;

        // @ts-ignore
        const {gherkinDocument, pickle} = testCaseInfo;
        const feature = gherkinDocument.feature;

        console.log("FEATURE: ", feature);
        console.log("PICKLE: ", pickle);
        console.log("GHK DOCUMENT: ", gherkinDocument);
        // Handle feature/suite start if it's a new feature
        if (!this.currentFeature || this.currentFeature.title !== feature.name) {
            if (this.currentFeature) {
                // End previous feature
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

        // Start new scenario
        this.currentScenario = {
            id: uuidv4(),
            title: pickle.name,
            steps: []
        };

        const data = this.eventHandler.eventNormalizer.normalizeTestStart(
            this.currentScenario.id,
            pickle.name,
            gherkinDocument.uri,
            pickle.steps.map((step: any) => step.text).join('\n'),
            {
                rabbitMqId: this.currentFeature.id,
                title: this.currentFeature.title
            }
        );
        this.eventHandler.queueEvent('test', data);
    }

    private onTestStepStarted(testStepStarted: any): void {
        console.log("ON TEST STEP STARTED: ", testStepStarted);
        if (!this.currentScenario) return;

        const {testStep} = testStepStarted;
        if (testStep.text) {
            this.currentScenario.steps.push(testStep.text);
        }
    }

    private onTestStepFinished(testStepFinished: any): void {
        console.log("ON TEST STEP FINISHED: ", testStepFinished);
        if (!this.currentScenario) return;

        const {testStep, testStepResult} = testStepFinished;
        if (testStepResult.status === 'FAILED') {
            this.currentScenario.error = testStepResult.message;
            this.currentScenario.stack = testStepResult.exception?.stack || '';
        }
    }

    private onTestCaseFinished(testCaseFinished: any): void {
        console.log("ON TEST CASE FINISHED: ", testCaseFinished);
        console.log("THIS.CURRENTSCENARIO: ", this.currentScenario);
        if (!this.currentScenario || !this.currentFeature) return;

        const {testCaseResult} = testCaseFinished;
        if (testCaseResult.status === 'FAILED') {
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
                    duration: testCaseResult.duration?.seconds || 0,
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