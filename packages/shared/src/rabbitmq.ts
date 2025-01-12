import * as amqp from 'amqplib/callback_api';
import { MessageData, RabbitMQConfig } from './types';
import { getRabbitMQConfig } from './config';

export class RabbitMQPublisher {
    private channel: any;
    private readonly config: RabbitMQConfig;

    constructor(config?: Partial<RabbitMQConfig>) {
        this.config = { ...getRabbitMQConfig(), ...config };
        this.channel = null;
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            amqp.connect(this.config.url, (err, connection) => {
                if (err) reject(err);
                connection.createChannel((err, channel) => {
                    if (err) reject(err);
                    this.channel = channel;

                    this.channel.assertExchange(this.config.exchange, 'direct', {
                        durable: true,
                        autoDelete: false
                    });

                    this.channel.assertQueue(this.config.queue, {
                        durable: true,
                        deadLetterExchange: this.config.deadLetterExchange,
                        deadLetterRoutingKey: this.config.deadLetterRoutingKey,
                        messageTtl: this.config.messageTtl,
                        maxLength: this.config.maxLength
                    });

                    this.channel.bindQueue(this.config.queue, this.config.exchange, this.config.routingKey);
                    resolve();
                });
            });
        });
    }

    publishMessage(event: string, data: MessageData): boolean {
        if (!this.channel) {
            throw new Error('Channel not initialized');
        }

        const message = {
            event,
            data,
            apiKey: process.env.TESTPIG_API_KEY
        };

        return this.channel.publish(
            this.config.exchange,
            this.config.routingKey,
            Buffer.from(JSON.stringify(message))
        );
    }
}