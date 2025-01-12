import * as Mocha from 'mocha';
import { TestStatus, MessageData, RabbitMQPublisher } from '@testpig/shared';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';

const EVENT_RUN_BEGIN = 'start';
const EVENT_RUN_END = 'end';
const EVENT_TEST_BEGIN = 'test';
const EVENT_TEST_END = 'test end';
const EVENT_SUITE_BEGIN = 'suite';
const EVENT_SUITE_END = 'suite end';
const EVENT_TEST_FAIL = 'fail';
const EVENT_TEST_PASS = 'pass';

const testRunMap = new Map<string, Partial<MessageData>>();

class MochaReporter extends Mocha.reporters.Base {
    private publisher: RabbitMQPublisher;
    private eventQueue: { event: string; data: MessageData }[] = [];
    private testRunTitle: string;

    constructor(runner: Mocha.Runner, options: Mocha.MochaOptions) {
        super(runner, options);

        if (!process.env.TESTPIG_API_KEY) {
            throw new Error('TESTPIG_API_KEY environment variable not set.');
        }

        const reporterOptions = options.reporterOptions as any || {};
        if (!reporterOptions.projectId) {
            throw new Error('projectId is required in reporterOptions');
        }

        const { projectId, runId } = reporterOptions;
        this.publisher = new RabbitMQPublisher();
        this.testRunTitle = runId || execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

        this.publisher.connect().catch(err => console.error('Failed to connect to RabbitMQ:', err));
        this.setupEventHandlers(runner, projectId);
    }

    private setupEventHandlers(runner: Mocha.Runner, projectId: string) {
        runner.on(EVENT_RUN_BEGIN, () => {
            let existingTestRun = testRunMap.get(`${projectId}-${this.testRunTitle}`);
            if (!existingTestRun) {
                const rabbitMqId = uuidv4();
                testRunMap.set(`${projectId}-${this.testRunTitle}`, {
                    rabbitMqId,
                    title: this.testRunTitle,
                    status: TestStatus.RUNNING,
                    projectId,
                });
                existingTestRun = testRunMap.get(`${projectId}-${this.testRunTitle}`);
            }
            this.eventQueue.push({ event: EVENT_RUN_BEGIN, data: existingTestRun as MessageData });
        });

        runner.on(EVENT_SUITE_BEGIN, (suite) => {
            if (!suite.title || suite.root) return;

            const existingTestRun = testRunMap.get(`${projectId}-${this.testRunTitle}`);
            const suiteId = uuidv4();
            (suite as any).testSuiteId = suiteId;

            this.eventQueue.push({
                event: EVENT_SUITE_BEGIN,
                data: new MessageData(EVENT_SUITE_BEGIN, {
                    fileName: suite.file,
                    projectId,
                    status: TestStatus.RUNNING,
                    startTime: new Date(),
                    rabbitMqId: suiteId,
                    title: suite.title,
                    testTool: 'Mocha',
                    testType: 'unit',
                    testRun: {
                        rabbitMqId: existingTestRun?.rabbitMqId,
                        title: this.testRunTitle
                    },
                    testCaseCount: suite.tests.length,
                    system: {
                        os: process.platform,
                        architecture: process.arch,
                        browser: 'Node.js',
                        framework: 'Node.js',
                        frameworkVersion: process.version
                    },
                    git: {
                        user: execSync('git config user.name', { encoding: 'utf8' }).trim(),
                        email: execSync('git config user.email', { encoding: 'utf8' }).trim(),
                        branch: execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
                    }
                })
            });
        });

        runner.on(EVENT_TEST_BEGIN, (test) => {
            const testId = uuidv4();
            (test as any).testCaseId = testId;

            this.eventQueue.push({
                event: EVENT_TEST_BEGIN,
                data: new MessageData(EVENT_TEST_BEGIN, {
                    projectId,
                    rabbitMqId: testId,
                    startTime: new Date(),
                    testSuite: {
                        rabbitMqId: (test.parent as any)?.testSuiteId,
                        title: test.parent?.title
                    },
                    title: test.title,
                    status: TestStatus.RUNNING,
                    fileName: test.file,
                    testBody: test.body
                })
            });
        });

        runner.on(EVENT_TEST_PASS, (test) => {
            const existingTestRun = testRunMap.get(`${projectId}-${this.testRunTitle}`);
            
            this.eventQueue.push({
                event: EVENT_TEST_PASS,
                data: new MessageData(EVENT_TEST_PASS, {
                    projectId,
                    rabbitMqId: (test as any).testCaseId,
                    testSuite: {
                        rabbitMqId: (test.parent as any)?.testSuiteId,
                        title: test.parent?.title
                    },
                    testRun: {
                        rabbitMqId: existingTestRun?.rabbitMqId,
                        title: this.testRunTitle
                    },
                    title: test.title,
                    status: TestStatus.PASSED,
                    duration: test.duration,
                    endTime: new Date()
                })
            });
        });

        runner.on(EVENT_TEST_FAIL, (test, err) => {
            const existingTestRun = testRunMap.get(`${projectId}-${this.testRunTitle}`);
            
            this.eventQueue.push({
                event: EVENT_TEST_FAIL,
                data: new MessageData(EVENT_TEST_FAIL, {
                    projectId,
                    rabbitMqId: (test as any).testCaseId,
                    testSuite: {
                        rabbitMqId: (test.parent as any)?.testSuiteId,
                        title: test.parent?.title
                    },
                    testRun: {
                        rabbitMqId: existingTestRun?.rabbitMqId,
                        title: this.testRunTitle
                    },
                    title: test.title,
                    error: err.message,
                    stack: err.stack,
                    status: TestStatus.FAILED,
                    duration: test.duration,
                    endTime: new Date()
                })
            });
        });

        runner.on(EVENT_SUITE_END, (suite) => {
            if (!suite.title || suite.root) return;

            const existingTestRun = testRunMap.get(`${projectId}-${this.testRunTitle}`);
            
            this.eventQueue.push({
                event: EVENT_SUITE_END,
                data: new MessageData(EVENT_SUITE_END, {
                    projectId,
                    endTime: new Date(),
                    rabbitMqId: (suite as any).testSuiteId,
                    title: suite.title,
                    status: suite.tests.some(t => t.state === 'failed') ? TestStatus.FAILED : TestStatus.PASSED,
                    testRun: {
                        rabbitMqId: existingTestRun?.rabbitMqId,
                        title: this.testRunTitle
                    }
                })
            });
        });

        runner.on(EVENT_RUN_END, () => {
            const existingTestRun = testRunMap.get(`${projectId}-${this.testRunTitle}`);
            const stats = runner.stats;
            
            this.eventQueue.push({
                event: EVENT_RUN_END,
                data: new MessageData(EVENT_RUN_END, {
                    rabbitMqId: existingTestRun?.rabbitMqId,
                    title: this.testRunTitle,
                    status: stats?.failures ? TestStatus.FAILED : TestStatus.PASSED,
                    projectId,
                    testRun: {
                        rabbitMqId: existingTestRun?.rabbitMqId,
                        title: this.testRunTitle
                    },
                    endTime: new Date()
                })
            });

            this.processEventQueue();
        });
    }

    private processEventQueue() {
        while (this.eventQueue.length > 0) {
            const { event, data } = this.eventQueue.shift()!;
            this.publisher.publishMessage(event, data);
        }
    }
}

module.exports = MochaReporter;