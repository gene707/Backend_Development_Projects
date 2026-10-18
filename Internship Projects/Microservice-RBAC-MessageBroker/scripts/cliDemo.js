import app from '../src/app.js';
import { config } from '../src/config/index.js';
import { getDatabase, seedInitialUsers, closeDatabase } from '../src/db/connection.js';
import { messageBroker } from '../src/broker/messageBroker.js';
import { transactionWorker } from '../src/worker/transactionWorker.js';

const DEMO_PORT = 3996;
const baseUrl = `http://localhost:${DEMO_PORT}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function printSection(title) {
  console.log('\n\x1b[36m' + '='.repeat(68) + '\x1b[0m');
  console.log(`\x1b[1m\x1b[33m▶ ${title}\x1b[0m`);
  console.log('\x1b[36m' + '-'.repeat(68) + '\x1b[0m');
}

async function runDemo() {
  console.log('\n\x1b[32m====================================================================\x1b[0m');
  console.log('\x1b[1m  ROLE-BASED MICROSERVICE ECOSYSTEM & MESSAGE BROKER - LIVE DEMO\x1b[0m');
  console.log('\x1b[32m====================================================================\x1b[0m');

  await getDatabase();
  await seedInitialUsers();
  await messageBroker.connect();
  await transactionWorker.start();

  const server = await new Promise((resolve) => {
    const s = app.listen(DEMO_PORT, () => resolve(s));
  });

  try {
    // 1. Health & Broker Engine
    printSection('1. HEALTH & MESSAGE BROKER ENGINE STATUS');
    const health = await fetch(`${baseUrl}/health`).then((r) => r.json());
    console.log(JSON.stringify(health, null, 2));

    // 2. Authentication & JWT RBAC Generation
    printSection('2. AUTHENTICATION & JWT RBAC TOKEN ISSUANCE');
    const userRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'AlicePass123!' }),
    }).then((r) => r.json());

    const adminRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'AdminPass123!' }),
    }).then((r) => r.json());

    console.log(`  \x1b[32m✔ User Token Issued:\x1b[0m Alice [Role: ${userRes.user.role}] -> JWT: ${userRes.token.substring(0, 30)}...`);
    console.log(`  \x1b[32m✔ Admin Token Issued:\x1b[0m Admin [Role: ${adminRes.user.role}] -> JWT: ${adminRes.token.substring(0, 30)}...`);

    // 3. RBAC Tier Enforcement Demo
    printSection('3. RBAC TIER REJECTION: REGULAR USER CALLS /admin/audit-logs');
    console.log('  \x1b[90mAttempting: Alice (role: user) -> GET /api/v1/admin/audit-logs\x1b[0m');
    const forbiddenRes = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${userRes.token}` },
    });
    console.log(`  \x1b[33mResponse Status: ${forbiddenRes.status} ${forbiddenRes.statusText}\x1b[0m`);
    console.log(' ', JSON.stringify(await forbiddenRes.json(), null, 2));

    // 4. Asynchronous Transaction Dispatch (Message Broker)
    printSection('4. ASYNC TRANSACTION INGESTION (MESSAGE BROKER QUEUE)');
    console.log('  \x1b[90mSending: POST /api/v1/transactions with $12,500.00 payload\x1b[0m');
    const txRes = await fetch(`${baseUrl}/api/v1/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userRes.token}`,
      },
      body: JSON.stringify({
        amount: 12500.0,
        currency: 'USD',
        recipient: 'FinTech Clearinghouse Corp',
      }),
    });

    console.log(`  \x1b[32mResponse Status: ${txRes.status} ${txRes.statusText} (Lock-free async acceptance)\x1b[0m`);
    const txBody = await txRes.json();
    console.log(' ', JSON.stringify(txBody, null, 2));

    // 5. Decoupled Worker Execution
    printSection('5. DECOUPLED BACKGROUND WORKER FINALIZATION (ZERO DB LOCKS)');
    console.log('  \x1b[90mWaiting for asynchronous worker consumption from broker queue...\x1b[0m');
    await sleep(250);

    const completedTx = await fetch(`${baseUrl}/api/v1/transactions/${txBody.transactionId}`, {
      headers: { Authorization: `Bearer ${userRes.token}` },
    }).then((r) => r.json());
    console.log(' ', JSON.stringify(completedTx, null, 2));

    // 6. Admin Telemetry & Broker Metrics
    printSection('6. ADMIN TELEMETRY: BROKER QUEUE DEPTH & AUDIT LOGS');
    const brokerStats = await fetch(`${baseUrl}/api/v1/admin/broker-stats`, {
      headers: { Authorization: `Bearer ${adminRes.token}` },
    }).then((r) => r.json());
    console.log(JSON.stringify(brokerStats, null, 2));

    console.log('\n\x1b[32m✔ Live Microservice & Message Broker CLI simulation completed successfully!\x1b[0m\n');
  } finally {
    server.close();
    await messageBroker.close();
    await closeDatabase();
    process.exit(0);
  }
}

runDemo().catch((err) => {
  console.error('\x1b[31m[Demo Error]:\x1b[0m', err);
  process.exit(1);
});
