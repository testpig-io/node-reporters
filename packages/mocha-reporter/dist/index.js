"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const Mocha = __importStar(require("mocha"));
const shared_1 = require("@testpig/shared");
const uuid_1 = require("uuid");
const child_process_1 = require("child_process");
const EVENT_RUN_BEGIN = 'start';
const EVENT_RUN_END = 'end';
const EVENT_TEST_BEGIN = 'test';
const EVENT_TEST_END = 'test end';
const EVENT_SUITE_BEGIN = 'suite';
const EVENT_SUITE_END = 'suite end';
const EVENT_TEST_FAIL = 'fail';
const EVENT_TEST_PASS = 'pass';
const testRunMap = new Map();
class MochaReporter extends Mocha.reporters.Base {
    constructor(runner, options) {
        super(runner, options);
        this.eventQueue = [];
        if (!process.env.TESTPIG_API_KEY) {
            throw new Error('TESTPIG_API_KEY environment variable not set.');
        }
        const reporterOptions = options.reporterOptions || {};
        if (!reporterOptions.projectId) {
            throw new Error('projectId is required in reporterOptions');
        }
        const { projectId, runId } = reporterOptions;
        this.publisher = new shared_1.RabbitMQPublisher();
        this.testRunTitle = runId || (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        this.publisher.connect().catch(err => console.error('Failed to connect to RabbitMQ:', err));
        this.setupEventHandlers(runner, projectId);
    }
    setupEventHandlers(runner, projectId) {
        runner.on(EVENT_RUN_BEGIN, () => {
            let existingTestRun = testRunMap.get(`${projectId}-${this.testRunTitle}`);
            if (!existingTestRun) {
                const rabbitMqId = (0, uuid_1.v4)();
                testRunMap.set(`${projectId}-${this.testRunTitle}`, {
                    rabbitMqId,
                    title: this.testRunTitle,
                    status: shared_1.TestStatus.RUNNING,
                    projectId,
                });
                existingTestRun = testRunMap.get(`${projectId}-${this.testRunTitle}`);
            }
            this.eventQueue.push({ event: EVENT_RUN_BEGIN, data: existingTestRun });
        });
        runner.on(EVENT_SUITE_BEGIN, (suite) => {
            if (!suite.title || suite.root)
                return;
            const existingTestRun = testRunMap.get(`${projectId}-${this.testRunTitle}`);
            const suiteId = (0, uuid_1.v4)();
            suite.testSuiteId = suiteId;
            this.eventQueue.push({
                event: EVENT_SUITE_BEGIN,
                data: new shared_1.MessageData(EVENT_SUITE_BEGIN, {
                    fileName: suite.file,
                    projectId,
                    status: shared_1.TestStatus.RUNNING,
                    startTime: new Date(),
                    rabbitMqId: suiteId,
                    title: suite.title,
                    testTool: 'Mocha',
                    testType: 'unit',
                    testRun: {
                        rabbitMqId: existingTestRun === null || existingTestRun === void 0 ? void 0 : existingTestRun.rabbitMqId,
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
                        user: (0, child_process_1.execSync)('git config user.name', { encoding: 'utf8' }).trim(),
                        email: (0, child_process_1.execSync)('git config user.email', { encoding: 'utf8' }).trim(),
                        branch: (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
                    }
                })
            });
        });
        runner.on(EVENT_TEST_BEGIN, (test) => {
            var _a, _b;
            const testId = (0, uuid_1.v4)();
            test.testCaseId = testId;
            this.eventQueue.push({
                event: EVENT_TEST_BEGIN,
                data: new shared_1.MessageData(EVENT_TEST_BEGIN, {
                    projectId,
                    rabbitMqId: testId,
                    startTime: new Date(),
                    testSuite: {
                        rabbitMqId: (_a = test.parent) === null || _a === void 0 ? void 0 : _a.testSuiteId,
                        title: (_b = test.parent) === null || _b === void 0 ? void 0 : _b.title
                    },
                    title: test.title,
                    status: shared_1.TestStatus.RUNNING,
                    fileName: test.file,
                    testBody: test.body
                })
            });
        });
        runner.on(EVENT_TEST_PASS, (test) => {
            var _a, _b;
            const existingTestRun = testRunMap.get(`${projectId}-${this.testRunTitle}`);
            this.eventQueue.push({
                event: EVENT_TEST_PASS,
                data: new shared_1.MessageData(EVENT_TEST_PASS, {
                    projectId,
                    rabbitMqId: test.testCaseId,
                    testSuite: {
                        rabbitMqId: (_a = test.parent) === null || _a === void 0 ? void 0 : _a.testSuiteId,
                        title: (_b = test.parent) === null || _b === void 0 ? void 0 : _b.title
                    },
                    testRun: {
                        rabbitMqId: existingTestRun === null || existingTestRun === void 0 ? void 0 : existingTestRun.rabbitMqId,
                        title: this.testRunTitle
                    },
                    title: test.title,
                    status: shared_1.TestStatus.PASSED,
                    duration: test.duration,
                    endTime: new Date()
                })
            });
        });
        runner.on(EVENT_TEST_FAIL, (test, err) => {
            var _a, _b;
            const existingTestRun = testRunMap.get(`${projectId}-${this.testRunTitle}`);
            this.eventQueue.push({
                event: EVENT_TEST_FAIL,
                data: new shared_1.MessageData(EVENT_TEST_FAIL, {
                    projectId,
                    rabbitMqId: test.testCaseId,
                    testSuite: {
                        rabbitMqId: (_a = test.parent) === null || _a === void 0 ? void 0 : _a.testSuiteId,
                        title: (_b = test.parent) === null || _b === void 0 ? void 0 : _b.title
                    },
                    testRun: {
                        rabbitMqId: existingTestRun === null || existingTestRun === void 0 ? void 0 : existingTestRun.rabbitMqId,
                        title: this.testRunTitle
                    },
                    title: test.title,
                    error: err.message,
                    stack: err.stack,
                    status: shared_1.TestStatus.FAILED,
                    duration: test.duration,
                    endTime: new Date()
                })
            });
        });
        runner.on(EVENT_SUITE_END, (suite) => {
            if (!suite.title || suite.root)
                return;
            const existingTestRun = testRunMap.get(`${projectId}-${this.testRunTitle}`);
            this.eventQueue.push({
                event: EVENT_SUITE_END,
                data: new shared_1.MessageData(EVENT_SUITE_END, {
                    projectId,
                    endTime: new Date(),
                    rabbitMqId: suite.testSuiteId,
                    title: suite.title,
                    status: suite.tests.some(t => t.state === 'failed') ? shared_1.TestStatus.FAILED : shared_1.TestStatus.PASSED,
                    testRun: {
                        rabbitMqId: existingTestRun === null || existingTestRun === void 0 ? void 0 : existingTestRun.rabbitMqId,
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
                data: new shared_1.MessageData(EVENT_RUN_END, {
                    rabbitMqId: existingTestRun === null || existingTestRun === void 0 ? void 0 : existingTestRun.rabbitMqId,
                    title: this.testRunTitle,
                    status: (stats === null || stats === void 0 ? void 0 : stats.failures) ? shared_1.TestStatus.FAILED : shared_1.TestStatus.PASSED,
                    projectId,
                    testRun: {
                        rabbitMqId: existingTestRun === null || existingTestRun === void 0 ? void 0 : existingTestRun.rabbitMqId,
                        title: this.testRunTitle
                    },
                    endTime: new Date()
                })
            });
            this.processEventQueue();
        });
    }
    processEventQueue() {
        while (this.eventQueue.length > 0) {
            const { event, data } = this.eventQueue.shift();
            this.publisher.publishMessage(event, data);
        }
    }
}
module.exports = MochaReporter;
//# sourceMappingURL=index.js.map