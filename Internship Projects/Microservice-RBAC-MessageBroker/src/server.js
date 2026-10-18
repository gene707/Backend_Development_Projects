import app from './app.js';
import { config } from './config/index.js';
import { getDatabase, seedInitialUsers, closeDatabase } from './db/connection.js';
import { messageBroker } from './broker/messageBroker.js';
import { transactionWorker } from './worker/transactionWorker.js';

async function bootstrap() {
  try {
    // 1. Initialize Relational Database & Seed RBAC Accounts
    await getDatabase();
    await seedInitialUsers();

    // 2. Connect to Asynchronous Message Broker (RabbitMQ or In-Memory fallback)
    await messageBroker.connect();

    // 3. Start Asynchronous Transaction Worker
    await transactionWorker.start();

    // 4. Start HTTP API Gateway
    const server = app.listen(config.port, () => {
      console.log('\n\x1b[36m====================================================================\x1b[0m');
      console.log('\x1b[1m\x1b[32m [ONLINE] Role-Based Microservice API Ecosystem with Message Brokers\x1b[0m');
      console.log('\x1b[36m====================================================================\x1b[0m');
      console.log(` \x1b[33mEnvironment:\x1b[0m      ${config.env}`);
      console.log(` \x1b[33mAPI Gateway:\x1b[0m      http://localhost:${config.port}`);
      console.log(` \x1b[33mHealth Check:\x1b[0m     http://localhost:${config.port}/health`);
      console.log(` \x1b[33mAuth Service:\x1b[0m     http://localhost:${config.port}/api/v1/auth`);
      console.log(` \x1b[33mTransactions:\x1b[0m     http://localhost:${config.port}/api/v1/transactions`);
      console.log(` \x1b[33mAdmin Service:\x1b[0m    http://localhost:${config.port}/api/v1/admin`);
      console.log(` \x1b[33mMessage Broker:\x1b[0m   ${messageBroker.getBrokerType()}`);
      console.log(` \x1b[33mActive Queue:\x1b[0m     ${config.queueName}`);
      console.log(` \x1b[33mDatabase:\x1b[0m         ${config.dbPath}`);
      console.log('\x1b[36m--------------------------------------------------------------------\x1b[0m');
      console.log(' Multi-tier ecosystem initialized and processing queue jobs.\n');
    });

    const shutdown = async (signal) => {
      console.log(`\n\x1b[33m[Server]\x1b[0m Received ${signal}. Shutting down services...`);
      server.close(async () => {
        await messageBroker.close();
        await closeDatabase();
        console.log('\x1b[32m[Server]\x1b[0m Clean shutdown complete.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    return server;
  } catch (error) {
    console.error('\x1b[31m[Fatal Boot Error]\x1b[0m', error);
    process.exit(1);
  }
}

export default bootstrap();
