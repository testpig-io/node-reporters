import { MessageData } from './types';
import { createLogger } from './logger';

export class APIClient {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly batchSize: number = 100;
    private messageQueue: { event: string; data: MessageData }[] = [];
    private logger = createLogger('APIClient');

    constructor(apiKey: string, baseUrl: string = process.env.TESTPIG_API_URL || 'http://localhost:3000') {
        if (!apiKey) {
            throw new Error('API key is required');
        }
        this.apiKey = apiKey;
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        this.logger.info(`Initialized with baseUrl: ${this.baseUrl}`);
    }

    async publishMessage(event: string, data: MessageData): Promise<boolean> {
        this.messageQueue.push({ event, data });
        this.logger.debug(`Added event '${event}' to queue (${this.messageQueue.length}/${this.batchSize})`);

        // If we've reached batch size, flush the queue
        if (this.messageQueue.length >= this.batchSize) {
            this.logger.info(`Batch size reached (${this.batchSize}), flushing queue...`);
            return this.flushQueue();
        }

        return true;
    }

    async flushQueue(): Promise<boolean> {
        if (this.messageQueue.length === 0) return true;

        this.logger.info(`Attempting to send ${this.messageQueue.length} messages to ${this.baseUrl}/reporter-events/batch`);
        this.logger.debug("Messages in queue:", this.messageQueue);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                this.logger.warn('Request timed out, aborting');
                controller.abort();
            }, 10000); // 10 second timeout
            this.logger.debug("Controller Signal:", controller.signal);
            
            try {
                this.logger.debug('Starting API request...');
                const response = await fetch(`${this.baseUrl}/reporter-events/batch`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`,
                        'User-Agent': 'TestPig-Reporter/1.0'
                    },
                    body: JSON.stringify({
                        messages: this.messageQueue
                    }),
                    signal: controller.signal
                });

                this.logger.info(`Response received: status=${response.status}, ok=${response.ok}`);

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`TestPig API Error: ${error || response.statusText}`);
                }

                // Clear the queue after successful send
                const oldQueueLength = this.messageQueue.length;
                this.messageQueue = [];
                this.logger.info(`Queue successfully cleared (${oldQueueLength} messages sent)`);
                return true;
            } finally {
                clearTimeout(timeoutId);
                this.logger.debug('Request completed or timed out');
            }
        } catch (error) {
            this.logger.error('Failed to send test results to TestPig:', error);
            this.logger.warn('Keeping messages in queue for potential retry');
            return false; // Return false but don't throw to avoid crashing
        }
    }
}
