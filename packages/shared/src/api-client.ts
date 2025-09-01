import { MessageData } from './types';
import { createLogger } from './logger';
import { FormData, Blob } from './form-data-compat';
import fetch from 'node-fetch';

export class APIClient {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly batchSize: number = 100;
    private messageQueue: { event: string; data: MessageData }[] = [];
    private logger = createLogger('APIClient');

    constructor(apiKey: string, baseUrl: string = process.env.TESTPIG_API_URL || 'https://app.testpig.io/api') {
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

    private sanitizeFileName(fileName: string): string {
        return fileName
            .replace(/\s+/g, '-')        // Replace spaces with hyphens
            .replace(/[^a-zA-Z0-9-_.]/g, '-')  // Replace other special chars with hyphens
            .replace(/--+/g, '-')        // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, '');      // Remove leading/trailing hyphens
    }

    async flushQueue(): Promise<boolean> {
        let logMessage = '';
        if (this.messageQueue.length === 0) return true;

        this.logger.info(`Attempting to send ${this.messageQueue.length} messages to ${this.baseUrl}/reporter-events/batch`);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                this.logger.warn('Request timed out, aborting');
                controller.abort();
            }, 10000); // 10 second timeout
            
            try {
                const formData = new FormData();
                this.logger.debug(`FormData created: ${JSON.stringify(formData, null, 2)}`);

                // Process queue and keep media with its message
                const processedMessages = this.messageQueue.map((message, index) => {
                    this.logger.info(`Processing message: ${index} ${JSON.stringify(message, null, 2)}`);
                    logMessage = `[logMessage] message: ${index} ${JSON.stringify(message, null, 2)}`;
                    if (message.data.media?.data) {
                        this.logger.info(`Processing media > Found media data: ${index} ${JSON.stringify(message.data.media, null, 2)}`);
                        const mediaId = message.data.rabbitMqId;
                        const sanitizedFileName = this.sanitizeFileName(message.data.media.fileName);
                        
                        // Convert back to Buffer if it's been JSON serialized
                        const mediaData = message.data.media.data as any;
                        const buffer = mediaData.type === 'Buffer' 
                            ? Buffer.from(mediaData.data)
                            : message.data.media.data;

                        this.logger.info(`Processing media > Converted buffer: ${index} ${JSON.stringify(buffer, null, 2)}`);

                        // this.logger.debug('Processing media for message:', {
                        //     messageId: mediaId,
                        //     originalFileName: message.data.media.fileName,
                        //     sanitizedFileName,
                        //     mimeType: message.data.media.mimeType,
                        //     dataSize: buffer.length,
                        //     isSerializedBuffer: mediaData.type === 'Buffer'
                        // });

                        // Add this specific message's media file to FormData with sanitized name
                        formData.append(
                            'media',
                            new Blob([buffer], {  // Use the properly converted buffer
                                type: message.data.media.mimeType 
                            }),
                            sanitizedFileName  // Use sanitized filename here
                        );

                        // Return message with media reference but without binary data
                        return {
                            ...message,
                            data: {
                                ...message.data,
                                media: {
                                    ...message.data.media,
                                    mediaId,
                                    fileName: sanitizedFileName,  // Update filename in message too
                                    data: undefined
                                }
                            }
                        };
                    }

                    return message;
                });

                logMessage = `[logMessage] <NoIndex> processedMessages: ${JSON.stringify(processedMessages, null, 2)}`;

                // Add messages JSON
                formData.append('messages', JSON.stringify(processedMessages));

                // this.logger.debug('Processed messages:', processedMessages);

                // Debug log what we're sending
                // this.logger.debug('Final FormData entries:');
                // for (const [key, value] of formData.entries()) {
                //     this.logger.debug('FormData entry:', {
                //         key,
                //         value: value instanceof Blob ? 
                //             `Blob (size: ${value.size}, type: ${value.type})` : 
                //             JSON.stringify(value, null, 2)
                //     });
                // }

                const response = await fetch(`${this.baseUrl}/reporter-events/batch`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'User-Agent': 'TestPig-Reporter/1.0'
                    },
                    body: formData as any,
                    signal: controller.signal
                });

                this.logger.debug(`Full response: ${JSON.stringify(response, null, 2)}`);

                this.logger.info(`Response received: status=${response.status}, ok=${response.ok}`);

                if (!response.ok) {
                    const error = await response.text();
                    this.logger.error(`TestPig Failed Message: ${JSON.stringify(this.messageQueue, null, 2)}`);
                    this.logger.error(`Full errored response: ${ JSON.stringify(response, null, 2)}`);
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
            this.logger.error(`Failed to send test results to TestPig > Error: ${error}`);
            this.logger.error(`Failed to send test results to TestPig: ${JSON.stringify(this.messageQueue, null, 2)}`);
            this.logger.error(`Failed to send test results to TestPig > Log Message: ${logMessage}`);
            this.logger.warn('Keeping messages in queue for potential retry');
            return false; // Return false but don't throw to avoid crashing
        }
    }
}
