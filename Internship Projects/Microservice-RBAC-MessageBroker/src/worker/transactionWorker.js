import { messageBroker } from '../broker/messageBroker.js';
import { run, get } from '../db/connection.js';
import { config } from '../config/index.js';

export class TransactionWorker {
  constructor(workerId = `worker-${process.pid}`) {
    this.workerId = workerId;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`\x1b[36m[TransactionWorker]\x1b[0m Worker ${this.workerId} initializing consumer on queue: ${config.queueName}`);

    await messageBroker.consume(config.queueName, async (transactionJob) => {
      await this.processJob(transactionJob);
    });

    console.log(`\x1b[32m[TransactionWorker]\x1b[0m Worker ${this.workerId} active and processing jobs asynchronously without DB locks.`);
  }

  async processJob(job) {
    const { id, user_id, amount, currency, recipient } = job;
    const startMs = Date.now();

    try {
      // 1. Mark status as 'processing' with assigned worker ID
      await run(
        `UPDATE transactions
         SET status = 'processing', worker_id = ?, updated_at = datetime('now', 'subsec')
         WHERE id = ?;`,
        [this.workerId, id]
      );

      // 2. Perform simulated financial settlement processing (e.g. clearing & ledger verification)
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 3. Commit finalized status as 'completed'
      await run(
        `UPDATE transactions
         SET status = 'completed',
             processed_at = datetime('now', 'subsec'),
             updated_at = datetime('now', 'subsec')
         WHERE id = ?;`,
        [id]
      );

      const durationMs = Date.now() - startMs;
      // Optional debug log
      if (process.env.DEBUG_WORKER) {
        console.log(`\x1b[90m[Worker ${this.workerId}]\x1b[0m Completed transaction ${id} (${currency} ${amount} to ${recipient}) in ${durationMs}ms`);
      }
    } catch (err) {
      console.error(`\x1b[31m[Worker ${this.workerId} Error]\x1b[0m Failed transaction ${id}:`, err.message);

      // Mark transaction as failed
      await run(
        `UPDATE transactions
         SET status = 'failed', retry_count = retry_count + 1, updated_at = datetime('now', 'subsec')
         WHERE id = ?;`,
        [id]
      );
      throw err;
    }
  }
}

export const transactionWorker = new TransactionWorker();
