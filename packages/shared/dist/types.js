"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageData = exports.TestStatus = void 0;
var TestStatus;
(function (TestStatus) {
    TestStatus["FAILED"] = "failed";
    TestStatus["PASSED"] = "passed";
    TestStatus["PENDING"] = "pending";
    TestStatus["SKIPPED"] = "skipped";
    TestStatus["RUNNING"] = "running";
})(TestStatus || (exports.TestStatus = TestStatus = {}));
class MessageData {
    constructor(event, data) {
        Object.assign(this, data);
    }
}
exports.MessageData = MessageData;
//# sourceMappingURL=types.js.map