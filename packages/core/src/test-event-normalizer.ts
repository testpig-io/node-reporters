import {TestStatus, MessageData, TestRunDetails, TestSuiteDetails, getGitInfo, TestEventsEnum} from '@testpig/shared';
import {v4 as uuidv4} from 'uuid';

export interface SystemInfo {
    os: string;
    architecture: string;
    browser: string;
    framework: string;
    frameworkVersion: string;
}

export enum TestEvents {
    RUN_START = 'run start',
    SUITE_START = 'suite',
    TEST_START = 'test start',
    TEST_PASS = 'test pass',
    TEST_FAIL = 'test fail',
    SUITE_END = 'suite end',
    RUN_END = 'run end'
}

export class TestEventNormalizer {
    private testRunMap = new Map<string, Partial<MessageData>>();
    private projectId: string;
    private testRunTitle: string;

    constructor(projectId: string, runId?: string) {
        this.projectId = projectId;

        const redColor = '\x1b[31m';
        const resetColor = '\x1b[0m';

        if (!projectId || projectId === 'undefined') {
            console.warn(`${redColor}WARNING! "projectId" is not provided. Test results will not be sent to TestPig! Please set the projectId in your test's configuration or use the env var TESTPIG_PROJECT_ID.${resetColor}`);
        }
        if (!runId || runId === 'undefined') {
            console.warn(`${redColor}WARNING! "runId" is not provided. Using current git branch name "${getGitInfo().branch}" as run title.\nTo set run as an explicit value, please set the runId in your test's configuration or use the env var TESTPIG_RUN_ID${resetColor}`);
            runId = getGitInfo().branch;
        }
        this.testRunTitle = runId;
    }

    normalizeRunStart(): MessageData {
        let existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);
        if (!existingTestRun) {
            const rabbitMqId = uuidv4();
            this.testRunMap.set(`${this.projectId}-${this.testRunTitle}`, {
                rabbitMqId,
                title: this.testRunTitle,
                status: TestStatus.RUNNING,
                projectId: this.projectId,
            });
            existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);
        }
        return existingTestRun as MessageData;
    }

    normalizeSuiteStart(
        suiteId: string,
        title: string,
        fileName: string,
        testCount: number,
        systemInfo: SystemInfo,
        testType: 'e2e' | 'unit'
    ): MessageData {
        const existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);

        return new MessageData(TestEventsEnum.SUITE_START, {
            fileName,
            projectId: this.projectId,
            status: TestStatus.RUNNING,
            startTime: new Date(),
            rabbitMqId: suiteId,
            title,
            testTool: systemInfo.framework,
            testType,
            testRun: {
                rabbitMqId: existingTestRun?.rabbitMqId,
                title: this.testRunTitle
            },
            testCaseCount: testCount,
            system: systemInfo,
            git: getGitInfo()
        });
    }

    normalizeTestStart(
        testId: string,
        title: string,
        fileName: string,
        testBody: string,
        testSuite: TestSuiteDetails
    ): MessageData {
        return new MessageData(TestEventsEnum.TEST_START, {
            projectId: this.projectId,
            rabbitMqId: testId,
            startTime: new Date(),
            testSuite,
            title,
            status: TestStatus.RUNNING,
            fileName,
            testBody
        });
    }

    normalizeTestPass({testId, title, duration, testSuite, retries}: {
                          testId: string,
                          title: string,
                          duration: number,
                          testSuite: TestSuiteDetails,
                          retries?: number
                      }
    ): MessageData {
        const existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);

        return new MessageData(TestEventsEnum.TEST_PASS, {
            projectId: this.projectId,
            rabbitMqId: testId,
            testSuite,
            testRun: {
                rabbitMqId: existingTestRun?.rabbitMqId,
                title: this.testRunTitle
            },
            title,
            status: TestStatus.PASSED,
            duration,
            endTime: new Date()
        });
    }

    normalizeTestFail({
                          testId,
                          title,
                          error,
                          stack,
                          testSuite
                      }: {
                          testId: string,
                          title: string,
                          error: string,
                          stack: string,
                          testSuite: TestSuiteDetails
                      }
    ): MessageData {
        const existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);
        const stripAnsi = (str: string): string => {
            return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
        };

        return new MessageData(TestEventsEnum.TEST_FAIL, {
            projectId: this.projectId,
            rabbitMqId: testId,
            testSuite,
            testRun: {
                rabbitMqId: existingTestRun?.rabbitMqId,
                title: this.testRunTitle
            },
            title,
            error: stripAnsi(error),
            stack: stripAnsi(stack),
            status: TestStatus.FAILED,
            endTime: new Date()
        });
    }

    normalizeSuiteEnd(
        suiteId: string,
        title: string,
        hasFailed: boolean
    ): MessageData {
        const existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);

        return new MessageData(TestEventsEnum.SUITE_END, {
            projectId: this.projectId,
            endTime: new Date(),
            rabbitMqId: suiteId,
            title,
            status: hasFailed ? TestStatus.FAILED : TestStatus.PASSED,
            testRun: {
                rabbitMqId: existingTestRun?.rabbitMqId,
                title: this.testRunTitle
            }
        });
    }

    normalizeRunEnd(hasFailed: boolean): MessageData {
        const existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);

        return new MessageData(TestEventsEnum.RUN_END, {
            rabbitMqId: existingTestRun?.rabbitMqId,
            title: this.testRunTitle,
            status: hasFailed ? TestStatus.FAILED : TestStatus.PASSED,
            projectId: this.projectId,
            testRun: {
                rabbitMqId: existingTestRun?.rabbitMqId,
                title: this.testRunTitle
            },
            endTime: new Date()
        });
    }
}