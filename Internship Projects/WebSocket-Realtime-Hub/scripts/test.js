import { WebSocket } from 'ws';
import server from '../src/server.js';
import { config } from '../src/config/index.js';
import { fileLogger } from '../src/storage/fileLogger.js';

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

function createClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${config.port}`);
    ws.messages = [];
    ws.on('message', (data) => {
      try {
        ws.messages.push(JSON.parse(data.toString()));
      } catch {}
    });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(client, filterFn, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const found = client.messages.find(filterFn);
      if (found) {
        clearInterval(interval);
        return resolve(found);
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error(`Timeout (${timeoutMs}ms) waiting for matching WebSocket message`));
      }
    }, 20);
  });
}

async function runTests() {
  console.log('\n\x1b[36m====================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[34m Running Automated WebSocket Communication Hub Test Suite\x1b[0m');
  console.log('\x1b[36m====================================================================\x1b[0m\n');

  const startTime = Date.now();
  await fileLogger.clearLogs();

  let clientAlice, clientBob, clientCharlie;

  try {
    // 1. HTTP Health & Status Check
    await test('GET /health returns 200 OK and cache engine status', async () => {
      const res = await fetch(`http://localhost:${config.port}/health`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.status === 'UP', 'Service status is not UP');
      assert('cacheEngine' in body, 'Missing cacheEngine in health payload');
    });

    // 2. Client Connection & Handshake
    await test('WebSocket clients connect and receive initial handshake frame', async () => {
      clientAlice = await createClient();
      clientBob = await createClient();
      clientCharlie = await createClient();

      assert(clientAlice.readyState === 1, 'Alice is not connected');
      assert(clientBob.readyState === 1, 'Bob is not connected');
      assert(clientCharlie.readyState === 1, 'Charlie is not connected');

      const welcome = await waitForMessage(clientAlice, (m) => m.type === 'connection_established');
      assert(welcome.type === 'connection_established', 'Expected connection_established event');
    });

    // 3. User Authentication & In-Memory / Redis Caching
    await test('Clients authenticate, cache profile, and auto-join #general', async () => {
      clientAlice.send(JSON.stringify({ type: 'auth', userId: 'usr-alice-101', username: 'Alice' }));
      const ackAlice = await waitForMessage(clientAlice, (m) => m.type === 'auth_success');
      assert(ackAlice.username === 'Alice', 'Alice auth failed');

      clientBob.send(JSON.stringify({ type: 'auth', userId: 'usr-bob-202', username: 'Bob' }));
      const ackBob = await waitForMessage(clientBob, (m) => m.type === 'auth_success');
      assert(ackBob.username === 'Bob', 'Bob auth failed');

      clientCharlie.send(JSON.stringify({ type: 'auth', userId: 'usr-charlie-303', username: 'Charlie' }));
      await waitForMessage(clientCharlie, (m) => m.type === 'auth_success');

      // Verify active users cached in memory/Redis via /stats endpoint
      const statsRes = await fetch(`http://localhost:${config.port}/stats`);
      const stats = await statsRes.json();
      assert(stats.activeUsers.length === 3, `Expected 3 active users cached, got ${stats.activeUsers.length}`);
    });

    // 4. Multi-Channel Joining
    await test('Clients subscribe to specific chat channels', async () => {
      clientAlice.send(JSON.stringify({ type: 'join', channel: 'engineering' }));
      const joinAlice = await waitForMessage(clientAlice, (m) => m.type === 'channel_joined' && m.channel === 'engineering');
      assert(joinAlice.channel === 'engineering', 'Alice failed to join engineering');

      clientBob.send(JSON.stringify({ type: 'join', channel: 'engineering' }));
      const joinBob = await waitForMessage(clientBob, (m) => m.type === 'channel_joined' && m.channel === 'engineering');
      assert(joinBob.channel === 'engineering', 'Bob failed to join engineering');

      // Charlie does NOT join engineering
    });

    // 5. Channel Message Broadcasting & Selective Routing
    await test('Broadcast delivered only to channel subscribers with transaction audit', async () => {
      clientAlice.send(
        JSON.stringify({
          type: 'message',
          channel: 'engineering',
          content: 'Deploying release v2.4.0 to production cluster',
        })
      );

      // Alice receives ack
      const ack = await waitForMessage(clientAlice, (m) => m.type === 'message_ack' && m.channel === 'engineering');
      assert(ack.deliveredCount >= 2, `Expected deliveredCount >= 2, got ${ack.deliveredCount}`);
      assert(typeof ack.transactionId === 'string', 'Missing transactionId');

      // Bob (subscribed) receives message
      const msgBob = await waitForMessage(
        clientBob,
        (m) => m.type === 'channel_message' && m.channel === 'engineering' && m.content.includes('Deploying release v2.4.0')
      );
      assert(msgBob.content.includes('Deploying release v2.4.0'), 'Bob did not receive broadcast message');

      // Charlie (NOT subscribed) does not receive it
      const msgCharlie = clientCharlie.messages.find((m) => m.type === 'channel_message' && m.channel === 'engineering');
      assert(!msgCharlie, 'Charlie incorrectly received message from unsubscribed channel');
    });

    // 6. Direct Private Messaging
    await test('Direct private messaging routes securely between two users', async () => {
      clientBob.send(
        JSON.stringify({
          type: 'direct',
          recipientUserId: 'usr-alice-101',
          content: 'Hey Alice, do you have the Kubernetes secret key?',
        })
      );

      const dmAck = await waitForMessage(clientBob, (m) => m.type === 'direct_message_ack');
      assert(dmAck.success === true, 'Direct message send failed');

      const dmReceived = await waitForMessage(clientAlice, (m) => m.type === 'direct_message');
      assert(dmReceived.from.username === 'Bob', 'Alice did not receive direct message from Bob');
      assert(dmReceived.content.includes('Kubernetes secret key'), 'DM content mismatch');
    });

    // 7. Persistent File Transaction Logging Verification
    await test('Persistent transactions.log records event timestamps and audit records on disk', async () => {
      const logsRes = await fetch(`http://localhost:${config.port}/logs?limit=20`);
      assert(logsRes.status === 200, `Expected 200, got ${logsRes.status}`);
      const logs = await logsRes.json();
      assert(logs.data.length >= 5, `Expected at least 5 logged transactions, found ${logs.data.length}`);

      const eventTypes = logs.data.map((l) => l.event);
      assert(eventTypes.includes('USER_CONNECT'), 'Missing USER_CONNECT in transaction log');
      assert(eventTypes.includes('CHANNEL_JOIN'), 'Missing CHANNEL_JOIN in transaction log');
      assert(eventTypes.includes('MESSAGE_BROADCAST'), 'Missing MESSAGE_BROADCAST in transaction log');
      assert(eventTypes.includes('DIRECT_MESSAGE'), 'Missing DIRECT_MESSAGE in transaction log');
      assert(typeof logs.data[0].timestamp === 'string', 'Missing ISO timestamp in log entry');
    });

    // 8. Client Disconnect & Cache Eviction
    await test('Client disconnect cleans up channels, evicts cache, and logs event', async () => {
      clientCharlie.close();
      await new Promise((r) => setTimeout(r, 200));

      const statsRes = await fetch(`http://localhost:${config.port}/stats`);
      const stats = await statsRes.json();
      const stillActive = stats.activeUsers.find((u) => u.userId === 'usr-charlie-303');
      assert(!stillActive, 'Charlie was not evicted from active user cache');
    });

    // 9. High-Concurrency Burst Test
    await test('High-concurrency burst: 10 parallel messages dispatched and audited', async () => {
      const promises = [];
      for (let i = 1; i <= 10; i++) {
        clientAlice.send(
          JSON.stringify({
            type: 'message',
            channel: 'engineering',
            content: `Concurrent burst packet #${i}`,
          })
        );
      }

      // Wait for burst completion
      await new Promise((r) => setTimeout(r, 300));
      const burstAcks = clientAlice.messages.filter((m) => m.type === 'message_ack' && m.channel === 'engineering');
      assert(burstAcks.length >= 10, `Expected at least 10 acks, got ${burstAcks.length}`);
    });
  } finally {
    if (clientAlice) clientAlice.close();
    if (clientBob) clientBob.close();
    if (clientCharlie) clientCharlie.close();
    server.close();
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
  console.error('\x1b[31m[Test Runner Error]:\x1b[0m', err);
  process.exit(1);
});
