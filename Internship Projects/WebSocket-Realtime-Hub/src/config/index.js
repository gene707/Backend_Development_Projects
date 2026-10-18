import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3003,
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  logDir: process.env.LOG_DIR || path.resolve(__dirname, '../../logs'),
  heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS, 10) || 30000,
  maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH, 10) || 4000,
};
