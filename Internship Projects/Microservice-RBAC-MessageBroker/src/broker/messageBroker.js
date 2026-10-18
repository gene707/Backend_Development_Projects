import amqplib from 'amqplib';
import { config } from '../config/index.js';

class MessageBroker {
  constructor() {
    this.amqpConnection = null;
    this.amqpChannel = null;
    this.isRabbitConnected = false;

    // High-performance In-Memory Broker Fallback Engine
    this.memoryQueues = new Map(); // queueName -> Array of message objects
    this.consumers = new Map(); // queueName -> Set of handler callbacks
    this.activeConsumers = new Map(); // queueName -> boolean processing flag
    this.stats = {
      published: 0,
      consumed: 0,
      failed: 0,
    };
  }

  async connect() {
    if (!config.brokerUrl) {
      this.isRabbitConnected = false;
      return;
    }

    try {
      // Attempt connection to RabbitMQ with short timeout to avoid terminal stalls
      const conn = await Promise.race([
        amqplib.connect(config.brokerUrl),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 1200)),
      ]);

      const ch = await conn.createChannel();
      await ch.assertQueue(config.queueName, { durable: true });

      this.amqpConnection = conn;
      this.amqpChannel = ch;
      this.isRabbitConnected = true;
      console.log('\x1b[32m[MessageBroker]\x1b[0m Connected to external RabbitMQ broker at', config.brokerUrl);

      conn.on('error', () => {
        this.isRabbitConnected = false;
      });
      conn.on('close', () => {
        this.isRabbitConnected = false;
      });
    } catch {
      this.isRabbitConnected = false;
      console.log('\x1b[33m[MessageBroker]\x1b[0m External RabbitMQ broker offline. In-Memory Asynchronous Message Broker engaged.');
    }
  }

  getBrokerType() {
    return this.isRabbitConnected ? 'RabbitMQ (AMQP Protocol)' : 'High-Throughput In-Memory Broker (Zero-Daemon Fallback)';
  }

  /**
   * Publishes a message to the specified queue.
   */
  async publish(queueName, payload) {
    this.stats.published++;
    const messageEnvelope = {
      messageId: payload.id || `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      payload,
    };

    if (this.isRabbitConnected && this.amqpChannel) {
      try {
        const buffer = Buffer.from(JSON.stringify(messageEnvelope));
        this.amqpChannel.sendToQueue(queueName, buffer, { persistent: true });
        return { success: true, messageId: messageEnvelope.messageId, broker: 'RabbitMQ' };
      } catch {
        this.isRabbitConnected = false;
      }
    }

    // In-memory queue fallback
    if (!this.memoryQueues.has(queueName)) {
      this.memoryQueues.set(queueName, []);
    }
    this.memoryQueues.get(queueName).push(messageEnvelope);

    // Trigger asynchronous queue dispatcher
    this.dispatchMemoryQueue(queueName);

    return { success: true, messageId: messageEnvelope.messageId, broker: 'In-Memory Async Broker' };
  }

  /**
   * Registers a worker consumer callback for the given queue.
   */
  async consume(queueName, handlerCallback) {
    if (this.isRabbitConnected && this.amqpChannel) {
      try {
        await this.amqpChannel.prefetch(config.workerConcurrency);
        await this.amqpChannel.consume(
          queueName,
          async (msg) => {
            if (msg !== null) {
              try {
                const parsed = JSON.parse(msg.content.toString());
                await handlerCallback(parsed.payload);
                this.amqpChannel.ack(msg);
                this.stats.consumed++;
              } catch (err) {
                console.error('[Worker Error] Processing failed:', err.message);
                this.amqpChannel.nack(msg, false, true); // Requeue upon failure
                this.stats.failed++;
              }
            }
          },
          { noAck: false }
        );
        return;
      } catch {
        this.isRabbitConnected = false;
      }
    }

    // In-Memory Consumer Registration
    if (!this.consumers.has(queueName)) {
      this.consumers.set(queueName, new Set());
    }
    this.consumers.get(queueName).add(handlerCallback);

    // Drain any existing messages
    this.dispatchMemoryQueue(queueName);
  }

  /**
   * Dispatches queued messages asynchronously to registered consumers.
   */
  async dispatchMemoryQueue(queueName) {
    if (this.activeConsumers.get(queueName)) return; // Prevent concurrent loop collision
    this.activeConsumers.set(queueName, true);

    setImmediate(async () => {
      try {
        const queue = this.memoryQueues.get(queueName);
        const handlers = this.consumers.get(queueName);

        if (!queue || !handlers || handlers.size === 0) {
          this.activeConsumers.set(queueName, false);
          return;
        }

        while (queue.length > 0) {
          const envelope = queue.shift();
          const handlerArray = Array.from(handlers);

          // Deliver in parallel across workers
          await Promise.allSettled(
            handlerArray.map(async (fn) => {
              try {
                await fn(envelope.payload);
                this.stats.consumed++;
              } catch (err) {
                console.error(`[In-Memory Broker Consumer Error]:`, err.message);
                this.stats.failed++;
              }
            })
          );
        }
      } finally {
        this.activeConsumers.set(queueName, false);
      }
    });
  }

  /**
   * Retrieves queue depth and broker telemetry.
   */
  getQueueStats(queueName = config.queueName) {
    const memoryDepth = this.memoryQueues.get(queueName)?.length || 0;
    return {
      brokerType: this.getBrokerType(),
      queueName,
      queueDepth: memoryDepth,
      stats: { ...this.stats },
    };
  }

  async close() {
    if (this.amqpChannel) {
      try {
        await this.amqpChannel.close();
      } catch {}
    }
    if (this.amqpConnection) {
      try {
        await this.amqpConnection.close();
      } catch {}
    }
    this.amqpChannel = null;
    this.amqpConnection = null;
    this.isRabbitConnected = false;
  }
}

export const messageBroker = new MessageBroker();
