import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3004,
  jwtSecret: process.env.JWT_SECRET || 'microservice_rbac_jwt_secret_token_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  brokerUrl: process.env.BROKER_URL || 'amqp://localhost:5672',
  queueName: process.env.QUEUE_NAME || 'transactions.queue',
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../data/ecosystem.sqlite'),
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY, 10) || 5,
};
