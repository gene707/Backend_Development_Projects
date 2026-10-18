import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';

class FileLogger {
  constructor() {
    this.logDir = path.resolve(config.logDir);
    this.logFile = path.join(this.logDir, 'transactions.log');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, '', 'utf8');
    }
  }

  getLogPath() {
    return this.logFile;
  }

  /**
   * Appends a structured transaction record with high-precision timestamp to the persistent log file.
   */
  async logTransaction({ event, transactionId = null, channel = null, userId = null, username = null, metadata = {} }) {
    const entry = {
      timestamp: new Date().toISOString(),
      timestampEpoch: Date.now(),
      event,
      transactionId,
      channel,
      userId,
      username,
      metadata,
    };

    const line = JSON.stringify(entry) + '\n';

    return new Promise((resolve, reject) => {
      fs.appendFile(this.logFile, line, 'utf8', (err) => {
        if (err) {
          console.error('[FileLogger Error] Failed to write log:', err.message);
          return reject(err);
        }
        resolve(entry);
      });
    });
  }

  /**
   * Reads and parses recent transactions from disk.
   */
  async getRecentTransactions(limit = 50) {
    if (!fs.existsSync(this.logFile)) return [];

    try {
      const content = await fs.promises.readFile(this.logFile, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      const parsed = lines.map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      }).filter(Boolean);

      return parsed.slice(-limit).reverse();
    } catch (err) {
      console.error('[FileLogger Error] Failed to read logs:', err);
      return [];
    }
  }

  /**
   * Clears transaction logs (useful during test resets).
   */
  async clearLogs() {
    this.ensureLogDir();
    await fs.promises.writeFile(this.logFile, '', 'utf8');
  }
}

export const fileLogger = new FileLogger();
