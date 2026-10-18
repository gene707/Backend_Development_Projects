import sqlite3 from 'sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance = null;

export async function getDatabase(customPath = null) {
  if (dbInstance) return dbInstance;

  const dbPath = customPath || config.dbPath;

  if (dbPath !== ':memory:') {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);

      db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON;');
        if (dbPath !== ':memory:') {
          db.run('PRAGMA journal_mode = WAL;');
        }
        dbInstance = db;
        resolve(dbInstance);
      });
    });
  });
}

export async function query(sql, params = []) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

export async function get(sql, params = []) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export async function run(sql, params = []) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export async function exec(sql) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function runMigrations() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await exec(schemaSql);
}

export async function seedInitialUsers() {
  await runMigrations();

  const existing = await get('SELECT COUNT(*) as count FROM users;');
  if (existing && existing.count > 0) return;

  const saltRounds = 10;
  const adminPass = await bcrypt.hash('AdminPass123!', saltRounds);
  const managerPass = await bcrypt.hash('ManagerPass123!', saltRounds);
  const userPass = await bcrypt.hash('AlicePass123!', saltRounds);

  await run(
    `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?);`,
    ['admin', 'admin@ecosystem.internal', adminPass, 'admin']
  );
  await run(
    `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?);`,
    ['manager', 'manager@ecosystem.internal', managerPass, 'manager']
  );
  await run(
    `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?);`,
    ['alice', 'alice@ecosystem.internal', userPass, 'user']
  );
}

export async function closeDatabase() {
  if (!dbInstance) return;
  return new Promise((resolve, reject) => {
    dbInstance.close((err) => {
      if (err) return reject(err);
      dbInstance = null;
      resolve();
    });
  });
}
