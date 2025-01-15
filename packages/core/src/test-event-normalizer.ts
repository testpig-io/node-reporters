import {TestStatus, MessageData, TestRunDetails, TestSuiteDetails, getGitInfo} from '@testpig/shared';
import {v4 as uuidv4} from 'uuid';

export interface SystemInfo {
    os: string;
    architecture: string;
    browser: string;
    framework: string;
    frameworkVersion: string;
}

export class TestEventNormalizer {
    private testRunMap = new Map<string, Partial<MessageData>>();
    private projectId: string;
    private testRunTitle: string;

    constructor(projectId: string, runId?: string) {
        this.projectId = projectId;
        if(!projectId) {
            console.warn('projectId is not provided. Test results will not be sent to TestPig!');
        }
        if(!runId) {
            console.log('runId is not provided. Using current git branch name as run title');
        }

        this.testRunTitle = runId || getGitInfo().branch;
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

        return new MessageData('suite', {
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
        return new MessageData('test', {
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

        return new MessageData('pass', {
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

        return new MessageData('fail', {
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

        return new MessageData('suite end', {
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

        return new MessageData('end', {
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