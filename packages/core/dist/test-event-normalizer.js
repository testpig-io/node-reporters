"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestEventNormalizer = void 0;
const shared_1 = require("@testpig/shared");
const uuid_1 = require("uuid");
const child_process_1 = require("child_process");
class TestEventNormalizer {
    constructor(projectId, runId) {
        this.testRunMap = new Map();
        this.projectId = projectId;
        this.testRunTitle = runId || (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    }
    normalizeRunStart() {
        let existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);
        if (!existingTestRun) {
            const rabbitMqId = (0, uuid_1.v4)();
            this.testRunMap.set(`${this.projectId}-${this.testRunTitle}`, {
                rabbitMqId,
                title: this.testRunTitle,
                status: shared_1.TestStatus.RUNNING,
                projectId: this.projectId,
            });
            existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);
        }
        return existingTestRun;
    }
    normalizeSuiteStart(suiteId, title, fileName, testCount, systemInfo, testType) {
        const existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);
        return new shared_1.MessageData('suite', {
            fileName,
            projectId: this.projectId,
            status: shared_1.TestStatus.RUNNING,
            startTime: new Date(),
            rabbitMqId: suiteId,
            title,
            testTool: systemInfo.framework,
            testType,
            testRun: {
                rabbitMqId: existingTestRun === null || existingTestRun === void 0 ? void 0 : existingTestRun.rabbitMqId,
                title: this.testRunTitle
            },
            testCaseCount: testCount,
            system: systemInfo,
            git: (0, shared_1.getGitInfo)()
        });
    }
    normalizeTestStart(testId, title, fileName, testBody, testSuite) {
        return new shared_1.MessageData('test', {
            projectId: this.projectId,
            rabbitMqId: testId,
            startTime: new Date(),
            testSuite,
            title,
            status: shared_1.TestStatus.RUNNING,
            fileName,
            testBody
        });
    }
    normalizeTestPass(testId, title, duration, testSuite) {
        const existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);
        return new shared_1.MessageData('pass', {
            projectId: this.projectId,
            rabbitMqId: testId,
            testSuite,
            testRun: {
                rabbitMqId: existingTestRun === null || existingTestRun === void 0 ? void 0 : existingTestRun.rabbitMqId,
                title: this.testRunTitle
            },
            title,
            status: shared_1.TestStatus.PASSED,
            duration,
            endTime: new Date()
        });
    }
    normalizeTestFail(testId, title, error, stack, duration, testSuite) {
        const existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);
        return new shared_1.MessageData('fail', {
            projectId: this.projectId,
            rabbitMqId: testId,
            testSuite,
            testRun: {
                rabbitMqId: existingTestRun === null || existingTestRun === void 0 ? void 0 : existingTestRun.rabbitMqId,
                title: this.testRunTitle
            },
            title,
            error,
            stack,
            status: shared_1.TestStatus.FAILED,
            duration,
            endTime: new Date()
        });
    }
    normalizeSuiteEnd(suiteId, title, hasFailed) {
        const existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);
        return new shared_1.MessageData('suite end', {
            projectId: this.projectId,
            endTime: new Date(),
            rabbitMqId: suiteId,
            title,
            status: hasFailed ? shared_1.TestStatus.FAILED : shared_1.TestStatus.PASSED,
            testRun: {
                rabbitMqId: existingTestRun === null || existingTestRun === void 0 ? void 0 : existingTestRun.rabbitMqId,
                title: this.testRunTitle
            }
        });
    }
    normalizeRunEnd(hasFailed) {
        const existingTestRun = this.testRunMap.get(`${this.projectId}-${this.testRunTitle}`);
        return new shared_1.MessageData('end', {
            rabbitMqId: existingTestRun === null || existingTestRun === void 0 ? void 0 : existingTestRun.rabbitMqId,
            title: this.testRunTitle,
            status: hasFailed ? shared_1.TestStatus.FAILED : shared_1.TestStatus.PASSED,
            projectId: this.projectId,
            testRun: {
                rabbitMqId: existingTestRun === null || existingTestRun === void 0 ? void 0 : existingTestRun.rabbitMqId,
                title: this.testRunTitle
            },
            endTime: new Date()
        });
    }
}
exports.TestEventNormalizer = TestEventNormalizer;
//# sourceMappingURL=test-event-normalizer.js.map