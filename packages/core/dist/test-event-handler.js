"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestEventHandler = void 0;
const shared_1 = require("@testpig/shared");
const test_event_normalizer_1 = require("./test-event-normalizer");
class TestEventHandler {
    constructor(projectId, runId) {
        this.eventQueue = [];
        if (!process.env.TESTPIG_API_KEY) {
            throw new Error('TESTPIG_API_KEY environment variable not set.');
        }
        this.publisher = new shared_1.RabbitMQPublisher();
        this.normalizer = new test_event_normalizer_1.TestEventNormalizer(projectId, runId);
        this.publisher.connect().catch(err => console.error('Failed to connect to RabbitMQ:', err));
    }
    queueEvent(event, data) {
        this.eventQueue.push({ event, data });
    }
    processEventQueue() {
        while (this.eventQueue.length > 0) {
            const { event, data } = this.eventQueue.shift();
            this.publisher.publishMessage(event, data);
        }
    }
    get eventNormalizer() {
        return this.normalizer;
    }
}
exports.TestEventHandler = TestEventHandler;
//# sourceMappingURL=test-event-handler.js.map