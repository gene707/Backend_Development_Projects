import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';
import { closeDatabase } from '../src/db/connection.js';

async function reset() {
  console.log('\x1b[33m[DB Reset]\x1b[0m Resetting database...');

  // If file exists, delete it
  if (config.dbPath !== ':memory:' && fs.existsSync(config.dbPath)) {
    try {
      fs.unlinkSync(config.dbPath);
      console.log(`\x1b[90mRemoved existing database file: ${config.dbPath}\x1b[0m`);
    } catch (err) {
      console.warn(`Could not delete file directly (${err.message}). Dropping tables instead.`);
    }
  }

  await runMigrations();
  await seedDatabase();
  await closeDatabase();
  console.log('\x1b[32m[DB Reset]\x1b[0m Database completely reset and reseeded successfully.');
}

reset().catch(async (err) => {
  console.error('\x1b[31m[Reset Error]:\x1b[0m', err);
  await closeDatabase();
  process.exit(1);
});
