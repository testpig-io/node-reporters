import {MessageData, APIClient} from '@testpig/shared';
import {TestEventNormalizer} from './test-event-normalizer';

export class TestEventHandler {
    private client: APIClient;
    private eventQueue: { event: string; data: MessageData }[] = [];
    private normalizer: TestEventNormalizer;

    constructor(projectId: string, runId?: string) {
        const apiKey = process.env.TESTPIG_API_KEY;
        // if TESTPIG_PROJECT_ID and/or TESTPIG_RUN_ID env vars are set, use that.
        // Otherwise fall back to projectId and/or runId if provided
        projectId = process.env.TESTPIG_PROJECT_ID ? process.env.TESTPIG_PROJECT_ID : projectId;
        runId = process.env.TESTPIG_RUN_ID ? process.env.TESTPIG_RUN_ID : runId;

        if (!projectId) {
            throw new Error('TESTPIG_PROJECT_ID environment variable not set.');
        }

        if (!apiKey || apiKey === 'undefined') {
            throw new Error('TESTPIG_API_KEY environment variable not set.');
        }

        this.client = new APIClient(apiKey);
        this.normalizer = new TestEventNormalizer(projectId, runId);
    }

    queueEvent(event: string, data: MessageData): void {
        this.eventQueue.push({event, data});
    }

    async processEventQueue(): Promise<void> {
        while (this.eventQueue.length > 0) {
            const {event, data} = this.eventQueue.shift()!;
            await this.client.publishMessage(event, data);
        }

        // Final flush to ensure any remaining messages are sent
        await this.client.flushQueue();
    }

    get eventNormalizer(): TestEventNormalizer {
        return this.normalizer;
    }
}