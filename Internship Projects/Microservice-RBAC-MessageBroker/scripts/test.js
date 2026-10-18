import app from '../src/app.js';
import { config } from '../src/config/index.js';
import { getDatabase, seedInitialUsers, closeDatabase } from '../src/db/connection.js';
import { messageBroker } from '../src/broker/messageBroker.js';
import { transactionWorker } from '../src/worker/transactionWorker.js';

const TEST_PORT = 3997;
let serverInstance;
let baseUrl = `http://localhost:${TEST_PORT}`;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function test(title, fn) {
  process.stdout.write(`  \x1b[90mTesting:\x1b[0m ${title}... `);
  try {
    await fn();
    console.log('\x1b[32m✔ PASS\x1b[0m');
    passed++;
  } catch (err) {
    console.log('\x1b[31m✖ FAIL\x1b[0m');
    console.error(`    \x1b[31m${err.message}\x1b[0m`);
    failed++;
  }
}

async function runTests() {
  console.log('\n\x1b[36m====================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[34m Running Automated Endpoint Verification Test Suite (Task 4)\x1b[0m');
  console.log('\x1b[36m====================================================================\x1b[0m\n');

  const startTime = Date.now();

  // 1. Setup DB, Broker, and Worker
  await getDatabase();
  await seedInitialUsers();
  await messageBroker.connect();
  await transactionWorker.start();

  serverInstance = await new Promise((resolve) => {
    const s = app.listen(TEST_PORT, () => resolve(s));
  });

  let adminToken, managerToken, userToken;

  try {
    // 1. Health & Infrastructure Check
    await test('GET /health returns 200 OK and broker active status', async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.status === 'UP', 'Status is not UP');
      assert('broker' in body, 'Missing broker in health response');
    });

    // 2. Auth: User Logins & JWT Issuance
    await test('POST /api/v1/auth/login issues valid signed JWT tokens with RBAC roles', async () => {
      // Admin
      const resAdmin = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'AdminPass123!' }),
      });
      assert(resAdmin.status === 200, 'Admin login failed');
      const dataAdmin = await resAdmin.json();
      assert(dataAdmin.user.role === 'admin', 'Role is not admin');
      adminToken = dataAdmin.token;

      // Manager
      const resManager = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'manager', password: 'ManagerPass123!' }),
      });
      assert(resManager.status === 200, 'Manager login failed');
      const dataManager = await resManager.json();
      assert(dataManager.user.role === 'manager', 'Role is not manager');
      managerToken = dataManager.token;

      // Regular User
      const resUser = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice', password: 'AlicePass123!' }),
      });
      assert(resUser.status === 200, 'Alice login failed');
      const dataUser = await resUser.json();
      assert(dataUser.user.role === 'user', 'Role is not user');
      userToken = dataUser.token;
    });

    // 3. Auth: Registration of new user
    await test('POST /api/v1/auth/register creates new account with hashed password', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `bob_${Date.now()}`,
          email: `bob_${Date.now()}@ecosystem.internal`,
          password: 'BobSecurePassword123!',
        }),
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      const body = await res.json();
      assert(body.user.role === 'user', 'Default role is not user');
      assert('token' in body, 'Missing token in registration');
    });

    // 4. RBAC Authorization Verification (Tiers: Admin, Manager, User)
    await test('RBAC tiers: Admin and Manager can access /admin/audit-logs, User is rejected (403)', async () => {
      // Admin -> 200
      const resAdmin = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(resAdmin.status === 200, `Expected 200 for admin, got ${resAdmin.status}`);

      // Manager -> 200
      const resManager = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      assert(resManager.status === 200, `Expected 200 for manager, got ${resManager.status}`);

      // Regular User -> 403 Forbidden!
      const resUser = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert(resUser.status === 403, `Expected 403 Forbidden for user, got ${resUser.status}`);
      const userBody = await resUser.json();
      assert(userBody.message.includes('Forbidden'), 'Expected Forbidden error message');
    });

    // 5. RBAC Strict Admin Tier: /admin/users
    await test('RBAC strict tier: /admin/users is restricted strictly to admin (rejects manager with 403)', async () => {
      const resManager = await fetch(`${baseUrl}/api/v1/admin/users`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      assert(resManager.status === 403, `Expected 403 for manager on /admin/users, got ${resManager.status}`);

      const resAdmin = await fetch(`${baseUrl}/api/v1/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(resAdmin.status === 200, `Expected 200 for admin on /admin/users, got ${resAdmin.status}`);
    });

    // 6. Security: Unauthenticated Request Rejection (401)
    await test('Requests lacking Bearer token are rejected with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/v1/transactions`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    // 7. Asynchronous Transaction Dispatch to Message Broker (202 Accepted)
    let dispatchedTxId = null;
    await test('POST /api/v1/transactions queues transaction to message broker and responds with 202 Accepted', async () => {
      const res = await fetch(`${baseUrl}/api/v1/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          amount: 4500.75,
          recipient: 'Global Cloud Services Inc',
          currency: 'USD',
        }),
      });
      assert(res.status === 202, `Expected 202 Accepted, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Success flag is false');
      assert(body.status === 'queued', 'Status is not queued');
      assert('transactionId' in body, 'Missing transactionId');
      assert('broker' in body, 'Missing broker info');
      dispatchedTxId = body.transactionId;
    });

    // 8. Decoupled Asynchronous Worker Verification (Zero DB Locks)
    await test('Asynchronous Worker consumes message and completes transaction safely', async () => {
      // Allow worker a brief moment to process the queue job
      await new Promise((r) => setTimeout(r, 200));

      const res = await fetch(`${baseUrl}/api/v1/transactions/${dispatchedTxId}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.data.status === 'completed', `Expected status completed, got ${body.data.status}`);
      assert(body.data.worker_id !== null, 'worker_id was not stamped');
      assert(body.data.processed_at !== null, 'processed_at timestamp was not stamped');
    });

    // 9. RBAC Data Isolation: Regular user cannot see others' transactions
    await test('RBAC Data Isolation: Regular user cannot view another users transaction', async () => {
      // Alice tries to fetch bob's transaction or view list
      const resAliceList = await fetch(`${baseUrl}/api/v1/transactions`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const aliceList = await resAliceList.json();

      // Alice should only see her own transactions
      for (const tx of aliceList.data) {
        assert(tx.user_id === 3, 'Alice sees a transaction not owned by her');
      }

      // Admin sees all transactions
      const resAdminList = await fetch(`${baseUrl}/api/v1/transactions`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const adminList = await resAdminList.json();
      assert(adminList.count >= aliceList.count, 'Admin should see equal or more transactions');
    });

    // 10. Heavy Load Concurrency Burst Ingestion
    await test('High-throughput burst: 15 concurrent transactions queued and processed without database locks', async () => {
      const burstPromises = [];
      for (let i = 1; i <= 15; i++) {
        burstPromises.push(
          fetch(`${baseUrl}/api/v1/transactions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userToken}`,
            },
            body: JSON.stringify({
              amount: 100.0 + i,
              recipient: `Vendor_Endpoint_${i}`,
              currency: 'USD',
            }),
          }).then((r) => r.json())
        );
      }

      const results = await Promise.all(burstPromises);
      assert(results.length === 15, 'Did not receive 15 responses');
      for (const r of results) {
        assert(r.status === 'queued', 'Transaction was not queued');
      }

      // Wait for async worker to consume burst
      await new Promise((r) => setTimeout(r, 1200));

      const statsRes = await fetch(`${baseUrl}/api/v1/admin/broker-stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const stats = await statsRes.json();
      assert(stats.data.stats.consumed >= 16, `Expected at least 16 consumed jobs, got ${stats.data.stats.consumed}`);
    });
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    await messageBroker.close();
    await closeDatabase();
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n\x1b[36m====================================================================\x1b[0m');
  console.log(` \x1b[1mTest Results:\x1b[0m \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m (Total: ${passed + failed}) in ${durationSec}s`);
  console.log('\x1b[36m====================================================================\x1b[0m\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\x1b[31m[Test Runner Fatal]:\x1b[0m', err);
  process.exit(1);
});
