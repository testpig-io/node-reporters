import { MessageData, RabbitMQPublisher } from '@testpig/shared';
import { TestEventNormalizer } from './test-event-normalizer';

export class TestEventHandler {
  private publisher: RabbitMQPublisher;
  private eventQueue: { event: string; data: MessageData }[] = [];
  private normalizer: TestEventNormalizer;
  private connectionPromise: Promise<void>;

  constructor(projectId: string, runId?: string) {
    if (!process.env.TESTPIG_API_KEY) {
      throw new Error('TESTPIG_API_KEY environment variable not set.');
    }

    this.publisher = new RabbitMQPublisher();
    this.normalizer = new TestEventNormalizer(projectId, runId);

    // Initialize connection
    this.connectionPromise = this.publisher.connect().catch(err => {
      console.error('Failed to connect to RabbitMQ:', err);
      throw err;
    });
  }

  queueEvent(event: string, data: MessageData): void {
    this.eventQueue.push({ event, data });
  }

  async processEventQueue(): Promise<void> {
    // Wait for connection to be established
    await this.connectionPromise;

    while (this.eventQueue.length > 0) {
      const { event, data } = this.eventQueue.shift()!;
      this.publisher.publishMessage(event, data);
    }
  }

  get eventNormalizer(): TestEventNormalizer {
    return this.normalizer;
  }
}