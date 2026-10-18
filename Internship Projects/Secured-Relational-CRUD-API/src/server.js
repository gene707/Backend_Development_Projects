import app from './app.js';
import { config } from './config/index.js';
import { getDatabase, closeDatabase } from './db/connection.js';
import { runMigrations } from './db/migrate.js';

async function startServer() {
  try {
    // 1. Establish Active Connection to SQL Database
    await getDatabase();

    // 2. Ensure Schema Migrations are Applied
    await runMigrations(true);

    // 3. Start HTTP Server
    const server = app.listen(config.port, () => {
      console.log('\n\x1b[36m====================================================================\x1b[0m');
      console.log('\x1b[1m\x1b[32m [ONLINE] Secured RESTful CRUD API Server with Relational Database\x1b[0m');
      console.log('\x1b[36m====================================================================\x1b[0m');
      console.log(` \x1b[33mEnvironment:\x1b[0m      ${config.env}`);
      console.log(` \x1b[33mServer Address:\x1b[0m   http://localhost:${config.port}`);
      console.log(` \x1b[33mHealth Check:\x1b[0m     http://localhost:${config.port}/health`);
      console.log(` \x1b[33mProjects API:\x1b[0m     http://localhost:${config.port}/api/v1/projects`);
      console.log(` \x1b[33mTasks API:\x1b[0m        http://localhost:${config.port}/api/v1/tasks`);
      console.log(` \x1b[33mStats API:\x1b[0m        http://localhost:${config.port}/api/v1/stats`);
      console.log(` \x1b[33mDatabase:\x1b[0m         ${config.dbPath}`);
      console.log('\x1b[36m--------------------------------------------------------------------\x1b[0m');
      console.log(' Press \x1b[1mCtrl+C\x1b[0m to gracefully shut down the server.\n');
    });

    // Graceful Shutdown Handlers
    const shutdown = async (signal) => {
      console.log(`\n\x1b[33m[Server]\x1b[0m Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        try {
          await closeDatabase();
          console.log('\x1b[32m[Server]\x1b[0m Database connection closed. Clean exit.');
          process.exit(0);
        } catch (err) {
          console.error('\x1b[31m[Server Error]\x1b[0m Error during shutdown:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    return server;
  } catch (error) {
    console.error('\x1b[31m[Fatal Boot Error]\x1b[0m Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
