"use strict";
const core_1 = require("@testpig/core");
const uuid_1 = require("uuid");
class CypressReporter {
    constructor(runner, options = {}) {
        this.failureCount = 0;
        const reporterOptions = options.reporterOptions || {};
        console.log("REPORTER OPTIONS: ", reporterOptions);
        if (!reporterOptions.projectId) {
            throw new Error('projectId is required in reporterOptions');
        }
        this.eventHandler = new core_1.TestEventHandler(reporterOptions.projectId, reporterOptions.runId);
        this.setupEventHandlers(runner);
    }
    setupEventHandlers(runner) {
        runner.on('start', () => {
            const data = this.eventHandler.eventNormalizer.normalizeRunStart();
            this.eventHandler.queueEvent('start', data);
        });
        runner.on('suite', (suite) => {
            var _a;
            if (!suite.title || suite.root)
                return;
            const suiteId = (0, uuid_1.v4)();
            suite.testSuiteId = suiteId;
            const data = this.eventHandler.eventNormalizer.normalizeSuiteStart(suiteId, suite.title, suite.invocationDetails.relativeFile, ((_a = suite.tests) === null || _a === void 0 ? void 0 : _a.length) || 0, {
                os: process.platform,
                architecture: process.arch,
                browser: 'Chrome', // Default to Chrome as we can't access Cypress.browser here
                framework: 'Cypress',
                frameworkVersion: require('cypress/package.json').version
            }, 'e2e');
            this.eventHandler.queueEvent('suite', data);
        });
        runner.on('test', (test) => {
            var _a, _b;
            const testId = (0, uuid_1.v4)();
            test.testCaseId = testId;
            const data = this.eventHandler.eventNormalizer.normalizeTestStart(testId, test.title, test.invocationDetails.relativeFile, test.body, {
                rabbitMqId: (_a = test.parent) === null || _a === void 0 ? void 0 : _a.testSuiteId,
                title: (_b = test.parent) === null || _b === void 0 ? void 0 : _b.title
            });
            this.eventHandler.queueEvent('test', data);
        });
        runner.on('pass', (test) => {
            var _a, _b;
            const data = this.eventHandler.eventNormalizer.normalizeTestPass(test.testCaseId, test.title, test.duration, {
                rabbitMqId: (_a = test.parent) === null || _a === void 0 ? void 0 : _a.testSuiteId,
                title: (_b = test.parent) === null || _b === void 0 ? void 0 : _b.title
            });
            this.eventHandler.queueEvent('pass', data);
        });
        runner.on('fail', (test, err) => {
            var _a, _b;
            this.failureCount++;
            const data = this.eventHandler.eventNormalizer.normalizeTestFail(test.testCaseId, test.title, err.message, err.stack || '', test.duration, {
                rabbitMqId: (_a = test.parent) === null || _a === void 0 ? void 0 : _a.testSuiteId,
                title: (_b = test.parent) === null || _b === void 0 ? void 0 : _b.title
            });
            this.eventHandler.queueEvent('fail', data);
        });
        runner.on('suite end', (suite) => {
            if (!suite.title || suite.root)
                return;
            const hasFailed = suite.tests.some((t) => t.state === 'failed');
            const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(suite.testSuiteId, suite.title, hasFailed);
            this.eventHandler.queueEvent('suite end', data);
        });
        runner.on('end', () => {
            const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
            this.eventHandler.queueEvent('end', data);
            this.eventHandler.processEventQueue();
        });
    }
}
module.exports = CypressReporter;
//# sourceMappingURL=index.js.map