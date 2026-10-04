import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../../data/submissions.json');

// Ensure data directory and file exist
async function initStore() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    const dir = path.dirname(DATA_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(DATA_FILE, '[]', 'utf-8');
  }
}

// Retrieve all submissions
export async function getAllSubmissions() {
  await initStore();
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading submissions:', err);
    return [];
  }
}

// Atomic save to file
async function saveAllSubmissions(submissions) {
  await initStore();
  const tempFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(submissions, null, 2), 'utf-8');
  await fs.rename(tempFile, DATA_FILE);
}

// Save a new contact form submission
export async function saveSubmission(entry) {
  const submissions = await getAllSubmissions();
  const record = {
    id: `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: entry.name.trim(),
    email: entry.email.trim().toLowerCase(),
    subject: entry.subject ? entry.subject.trim() : 'General Inquiry',
    message: entry.message.trim(),
    phone: entry.phone ? entry.phone.trim() : null,
    submittedAt: new Date().toISOString(),
    deliveryStatus: entry.deliveryStatus || 'stored',
    emailProof: entry.emailProof || null
  };

  submissions.unshift(record); // newest first
  await saveAllSubmissions(submissions);
  return record;
}

// Update submission status
export async function updateSubmissionStatus(id, deliveryStatus, emailProof = null) {
  const submissions = await getAllSubmissions();
  const index = submissions.findIndex(s => s.id === id);
  if (index === -1) return null;

  submissions[index].deliveryStatus = deliveryStatus;
  if (emailProof) {
    submissions[index].emailProof = emailProof;
  }
  await saveAllSubmissions(submissions);
  return submissions[index];
}

// Get single submission by ID
export async function getSubmissionById(id) {
  const submissions = await getAllSubmissions();
  return submissions.find(s => s.id === id) || null;
}
