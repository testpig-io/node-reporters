import { MessageData } from './types';

export class APIClient {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly batchSize: number = 100;
    private messageQueue: { event: string; data: MessageData }[] = [];

    constructor(apiKey: string, baseUrl: string = process.env.TESTPIG_API_URL || 'https://localhost:3000') {
        if (!apiKey) {
            throw new Error('API key is required');
        }
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    async publishMessage(event: string, data: MessageData): Promise<boolean> {
        this.messageQueue.push({ event, data });

        // If we've reached batch size, flush the queue
        if (this.messageQueue.length >= this.batchSize) {
            return this.flushQueue();
        }

        return true;
    }

    async flushQueue(): Promise<boolean> {
        if (this.messageQueue.length === 0) return true;

        try {
            const response = await fetch(`${this.baseUrl}/test-results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'User-Agent': 'TestPig-Reporter/1.0'
                },
                body: JSON.stringify({
                    messages: this.messageQueue
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`API Error: ${error.message || response.statusText}`);
            }

            // Clear the queue after successful send
            this.messageQueue = [];
            return true;
        } catch (error) {
            console.error('Failed to send test results:', error);
            return false;
        }
    }
}