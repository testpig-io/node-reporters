import {
  TestStatus,
  MessageData,
  TestSuiteDetails,
  getGitInfo,
  TestEventsEnum,
  createLogger,
  SystemDetails,
  MediaData,
  BrowserDetails,
} from "@testpig/shared";
import { v4 as uuidv4 } from "uuid";

export enum TestEvents {
  RUN_START = "run start",
  SUITE_START = "suite",
  TEST_START = "test start",
  TEST_PASS = "test pass",
  TEST_FAIL = "test fail",
  SUITE_END = "suite end",
  RUN_END = "run end",
}

export class TestEventNormalizer {
  private testRunMap = new Map<string, Partial<MessageData>>();
  private projectId: string;
  private testRunTitle: string;
  private _isProjectIdSet: boolean = false;
  private _isRunIdSet: boolean = false;
  private logger = createLogger("TestEventNormalizer");

  constructor(projectId: string, runId?: string) {
    this.projectId = projectId;

    if (projectId && projectId !== "undefined") {
      this._isProjectIdSet = true;
    }

    if (runId && runId !== "undefined") {
      this._isRunIdSet = true;
    }

    this.testRunTitle = runId || getGitInfo().branch;
    this.logger.info(
      `Initialized with projectId: ${projectId}, runId: ${
        runId || "not specified"
      }, using testRunTitle: ${this.testRunTitle}`
    );
  }

  normalizeRunStart(): MessageData {
    if (!this._isProjectIdSet) {
      this.logger.error(
        `"projectId" is not provided in the test config and TESTPIG_PROJECT_ID environment variable is not set. Test results will not be sent to TestPig!`
      );
    }
    if (!this._isRunIdSet) {
      this.logger.warn(
        `"runId" is not provided in the test config and TESTPIG_RUN_ID environment variable is not set. Using current git branch name "${
          getGitInfo().branch
        }" as run title.`
      );
    }

    let existingTestRun = this.testRunMap.get(
      `${this.projectId}-${this.testRunTitle}`
    );
    if (!existingTestRun) {
      const rabbitMqId = uuidv4();
      this.logger.debug(
        `Creating new test run with ID: ${rabbitMqId}, title: ${this.testRunTitle}`
      );
      this.testRunMap.set(`${this.projectId}-${this.testRunTitle}`, {
        rabbitMqId,
        title: this.testRunTitle,
        status: TestStatus.RUNNING,
        projectId: this.projectId,
      });
      existingTestRun = this.testRunMap.get(
        `${this.projectId}-${this.testRunTitle}`
      );
    } else {
      this.logger.debug(
        `Using existing test run: ${existingTestRun.rabbitMqId}`
      );
    }
    return existingTestRun as MessageData;
  }

  normalizeSuiteStart(
    suiteId: string,
    title: string,
    fileName: string,
    testCount: number,
    systemInfo: SystemDetails,
    testType: "e2e" | "unit" | "integration"
  ): MessageData {
    const existingTestRun = this.testRunMap.get(
      `${this.projectId}-${this.testRunTitle}`
    );
    this.logger.debug(
      `Normalizing suite start: ${title}, ID: ${suiteId}, testCount: ${testCount}`
    );

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
        title: this.testRunTitle,
      },
      testCaseCount: testCount,
      system: systemInfo,
      git: getGitInfo(),
    });
  }

  normalizeTestStart(
    testId: string,
    title: string,
    fileName: string,
    testBody: string,
    testSuite: TestSuiteDetails,
    browserDetails?: BrowserDetails
  ): MessageData {
    this.logger.debug(
      `Normalizing test start: ${title}, ID: ${testId}, suite: ${testSuite.title}`
    );

    return new MessageData(TestEventsEnum.TEST_START, {
      projectId: this.projectId,
      rabbitMqId: testId,
      startTime: new Date(),
      testSuite,
      title,
      status: TestStatus.RUNNING,
      fileName,
      testBody,
      browser: browserDetails,
    });
  }

  normalizeTestPass({
    testId,
    title,
    duration,
    testSuite,
    retries,
  }: {
    testId: string;
    title: string;
    duration?: number;
    testSuite: TestSuiteDetails;
    retries?: number;
  }): MessageData {
    const existingTestRun = this.testRunMap.get(
      `${this.projectId}-${this.testRunTitle}`
    );
    this.logger.debug(
      `Normalizing test pass: ${title}, ID: ${testId}, duration: ${duration}ms`
    );

    return new MessageData(TestEventsEnum.TEST_PASS, {
      projectId: this.projectId,
      rabbitMqId: testId,
      testSuite,
      testRun: {
        rabbitMqId: existingTestRun?.rabbitMqId,
        title: this.testRunTitle,
      },
      title,
      status: TestStatus.PASSED,
      duration,
      retries: retries?.toString(),
      endTime: new Date(),
    });
  }

  normalizeTestPending({
    testId,
    title,
    testSuite,
  }: {
    testId: string;
    title: string;
    testSuite: TestSuiteDetails;
  }): MessageData {
    this.logger.debug(`Normalizing test pending: ${title}, ID: ${testId}`);

    return new MessageData(TestEventsEnum.TEST_END, {
      projectId: this.projectId,
      rabbitMqId: testId,
      testSuite,
      title,
      status: TestStatus.PENDING,
      endTime: new Date(),
    });
  }

  normalizeTestSkip({
    testId,
    title,
    testSuite,
  }: {
    testId: string;
    title: string;
    testSuite: TestSuiteDetails;
  }): MessageData {
    this.logger.debug(`Normalizing test skip: ${title}, ID: ${testId}`);

    return new MessageData(TestEventsEnum.TEST_END, {
      projectId: this.projectId,
      rabbitMqId: testId,
      testSuite,
      title,
      status: TestStatus.SKIPPED,
      endTime: new Date(),
    });
  }

  normalizeTestFail({
    testId,
    title,
    error,
    stack,
    testSuite,
    duration,
    media,
  }: {
    testId: string;
    title: string;
    error: string;
    stack: string;
    testSuite: TestSuiteDetails;
    duration?: number;
    media?: MediaData;
  }): MessageData {
    const existingTestRun = this.testRunMap.get(
      `${this.projectId}-${this.testRunTitle}`
    );
    this.logger.debug(
      `Normalizing test fail: ${title}, ID: ${testId}, duration: ${duration}ms`
    );
    this.logger.debug(`Error: ${error}`);

    const stripAnsi = (str: string): string => {
      return str.replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        ""
      );
    };

    return new MessageData(TestEventsEnum.TEST_FAIL, {
      projectId: this.projectId,
      rabbitMqId: testId,
      testSuite,
      testRun: {
        rabbitMqId: existingTestRun?.rabbitMqId,
        title: this.testRunTitle,
      },
      title,
      error: stripAnsi(error),
      stack: stripAnsi(stack),
      status: TestStatus.FAILED,
      duration,
      endTime: new Date(),
      media,
    });
  }

  normalizeSuiteEnd(
    suiteId: string,
    title: string,
    hasFailed: boolean
  ): MessageData {
    const existingTestRun = this.testRunMap.get(
      `${this.projectId}-${this.testRunTitle}`
    );
    this.logger.debug(
      `Normalizing suite end: ${title}, ID: ${suiteId}, hasFailed: ${hasFailed}`
    );

    return new MessageData(TestEventsEnum.SUITE_END, {
      projectId: this.projectId,
      endTime: new Date(),
      rabbitMqId: suiteId,
      title,
      status: hasFailed ? TestStatus.FAILED : TestStatus.PASSED,
      testRun: {
        rabbitMqId: existingTestRun?.rabbitMqId,
        title: this.testRunTitle,
      },
    });
  }

  normalizeRunEnd(hasFailed: boolean): MessageData {
    const existingTestRun = this.testRunMap.get(
      `${this.projectId}-${this.testRunTitle}`
    );
    this.logger.info(`Normalizing run end, hasFailed: ${hasFailed}`);

    return new MessageData(TestEventsEnum.RUN_END, {
      rabbitMqId: existingTestRun?.rabbitMqId,
      title: this.testRunTitle,
      status: hasFailed ? TestStatus.FAILED : TestStatus.PASSED,
      projectId: this.projectId,
      testRun: {
        rabbitMqId: existingTestRun?.rabbitMqId,
        title: this.testRunTitle,
      },
      endTime: new Date(),
    });
  }
}
