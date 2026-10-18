import fs from 'node:fs';
import { config } from '../src/config/index.js';
import { getDatabase, runMigrations, seedInitialUsers, closeDatabase } from '../src/db/connection.js';

async function reset() {
  console.log('\x1b[33m[Reset]\x1b[0m Resetting database for Task 4...');
  if (config.dbPath !== ':memory:' && fs.existsSync(config.dbPath)) {
    try {
      fs.unlinkSync(config.dbPath);
    } catch {}
  }

  await getDatabase();
  await runMigrations();
  await seedInitialUsers();
  await closeDatabase();

  console.log('\x1b[32m[Reset]\x1b[0m Database successfully reset and seeded.');
}

reset().catch(async (err) => {
  console.error(err);
  await closeDatabase();
  process.exit(1);
});
