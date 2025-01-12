"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitMQPublisher = void 0;
const amqp = __importStar(require("amqplib/callback_api"));
const config_1 = require("./config");
class RabbitMQPublisher {
    constructor(config) {
        this.config = { ...(0, config_1.getRabbitMQConfig)(), ...config };
        this.channel = null;
    }
    async connect() {
        return new Promise((resolve, reject) => {
            amqp.connect(this.config.url, (err, connection) => {
                if (err)
                    reject(err);
                connection.createChannel((err, channel) => {
                    if (err)
                        reject(err);
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
    publishMessage(event, data) {
        if (!this.channel) {
            throw new Error('Channel not initialized');
        }
        const message = {
            event,
            data,
            apiKey: process.env.TESTPIG_API_KEY
        };
        return this.channel.publish(this.config.exchange, this.config.routingKey, Buffer.from(JSON.stringify(message)));
    }
}
exports.RabbitMQPublisher = RabbitMQPublisher;
//# sourceMappingURL=rabbitmq.js.map