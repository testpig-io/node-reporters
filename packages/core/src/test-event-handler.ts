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

    // get- and setEventQueue are solely used for the Cypress reporter - do not modify, do not remove
    setEventQueue(eventQueue: { event: string; data: MessageData }[]): void {
        this.eventQueue = eventQueue;
    }

    getEventQueue(): { event: string; data: MessageData }[] {
        return this.eventQueue;
    }

    queueEvent(event: string, data: MessageData): void {
        this.eventQueue.push({event, data});
    }

    async processEventQueue(): Promise<void> {
        console.log(`[TestEventHandler] Processing event queue with ${this.eventQueue.length} events`);
        
        if (this.eventQueue.length === 0) {
            console.log("[TestEventHandler] No events to process");
            return;
        }
        
        try {
            // Process all events in the queue
            while (this.eventQueue.length > 0) {
                const {event, data} = this.eventQueue.shift()!;
                await this.client.publishMessage(event, data);
                console.log(`[TestEventHandler] Published event: ${event}`);
            }
            
            // Final flush with retry mechanism
            let flushSuccess = false;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (!flushSuccess && retryCount < maxRetries) {
                console.log(`[TestEventHandler] Flushing queue (attempt ${retryCount + 1}/${maxRetries})...`);
                flushSuccess = await this.client.flushQueue();
                
                if (!flushSuccess) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        const delay = 1000 * retryCount; // Exponential backoff
                        console.log(`[TestEventHandler] Flush failed, retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
            
            if (flushSuccess) {
                console.log("[TestEventHandler] Queue processing completed successfully");
            } else {
                console.error("[TestEventHandler] Failed to flush queue after multiple attempts");
            }
            
            // Additional wait to ensure network operations complete
            console.log("[TestEventHandler] Waiting for any pending network operations...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log("[TestEventHandler] Wait complete");
        } catch (error) {
            console.error("[TestEventHandler] Error processing event queue:", error);
        }
    }

    get eventNormalizer(): TestEventNormalizer {
        return this.normalizer;
    }
}