import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../../data/users.json');

// Initialize database with default seed accounts if missing
export async function initStore() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    const dir = path.dirname(DATA_FILE);
    await fs.mkdir(dir, { recursive: true });

    // Seed default admin and standard user
    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('AdminPassword123!', salt);
    const userHash = await bcrypt.hash('UserPassword123!', salt);

    const initialUsers = [
      {
        id: 'usr-admin-1',
        name: 'System Admin',
        email: 'admin@example.com',
        passwordHash: adminHash,
        role: 'admin',
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'usr-regular-1',
        name: 'Standard User',
        email: 'user@example.com',
        passwordHash: userHash,
        role: 'user',
        createdAt: '2026-01-02T00:00:00.000Z'
      }
    ];

    await fs.writeFile(DATA_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
  }
}

// Read all users
export async function getAllUsers() {
  await initStore();
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading users file:', err);
    return [];
  }
}

// Atomic save users
async function saveAllUsers(users) {
  await initStore();
  const tempFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(users, null, 2), 'utf-8');
  await fs.rename(tempFile, DATA_FILE);
}

// Find user by email
export async function findByEmail(email) {
  const users = await getAllUsers();
  return users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
}

// Find user by ID (safe view without password)
export async function findById(id) {
  const users = await getAllUsers();
  const user = users.find(u => u.id === id);
  if (!user) return null;
  const { passwordHash: _hash, ...safeUser } = user;
  return safeUser;
}

// Create new user with hashed password
export async function createUser({ name, email, password, role = 'user' }) {
  const users = await getAllUsers();
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newUser = {
    id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash,
    role: role === 'admin' ? 'admin' : 'user',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  await saveAllUsers(users);

  const { passwordHash: _hash, ...safeUser } = newUser;
  return safeUser;
}
