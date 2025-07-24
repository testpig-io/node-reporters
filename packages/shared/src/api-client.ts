import { MessageData } from './types';
import { createLogger } from './logger';

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
                const formData = new FormData();
                const mediaFiles: Array<{
                    id: string;
                    data: Buffer;
                    fileName: string | undefined;
                    mimeType: string | undefined;
                }> = [];

                // Process queue and extract media
                const queueWithoutMedia = this.messageQueue.map(message => {
                    if (message.data.media?.data) {
                        const mediaData = message.data.media.data as any;  // Type assertion for checking
                        
                        this.logger.info('Media data found:', {
                            hasData: !!mediaData,
                            dataType: typeof mediaData,
                            isBuffer: Buffer.isBuffer(mediaData),
                            isBufferData: mediaData.type === 'Buffer',
                            dataArray: Array.isArray(mediaData.data)
                        });
                        
                        const mediaId = message.data.rabbitMqId;
                        
                        // Only add media if we have the required data
                        if (mediaId && mediaData) {
                            // Convert back to Buffer if it's been JSON serialized
                            const buffer = mediaData.type === 'Buffer' 
                                ? Buffer.from(mediaData.data)
                                : mediaData;

                            mediaFiles.push({
                                id: mediaId,
                                data: buffer,
                                fileName: message.data.media.fileName,
                                mimeType: message.data.media.mimeType
                            });
                            this.logger.info('Added media file to queue:', {
                                id: mediaId,
                                fileName: message.data.media.fileName,
                                mimeType: message.data.media.mimeType,
                                dataLength: buffer.length
                            });
                        }

                        // Replace media data with reference
                        return {
                            ...message,
                            data: {
                                ...message.data,
                                media: {
                                    ...message.data.media,
                                    mediaId,
                                    data: undefined
                                }
                            }
                        };
                    }
                    return message;
                });

                // Add messages JSON
                formData.append('messages', JSON.stringify(queueWithoutMedia));

                // Add media files - simplified approach
                mediaFiles.forEach(file => {
                    this.logger.info('Processing media file:', {
                        id: file.id,
                        fileName: file.fileName,
                        mimeType: file.mimeType,
                        dataLength: file.data.length
                    });
                    
                    formData.append('media', new Blob([file.data], { 
                        type: file.mimeType 
                    }), file.fileName);
                });

                this.logger.info('Final FormData entries:');
                for (const [key, value] of formData.entries()) {
                    this.logger.info('FormData entry:', {
                        key,
                        value: value instanceof Blob ? 
                            `Blob (size: ${value.size}, type: ${value.type})` : 
                            'JSON data'
                    });
                }

                const response = await fetch(`${this.baseUrl}/reporter-events/batch`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'User-Agent': 'TestPig-Reporter/1.0'
                    },
                    body: formData,
                    signal: controller.signal
                });

                this.logger.info(`Response received: status=${response.status}, ok=${response.ok}`);

                if (!response.ok) {
                    const error = await response.text();
                    this.logger.error('TestPig Failed Message:', JSON.stringify(this.messageQueue, null, 2));
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
