import { WebSocket } from 'ws';
import server from '../src/server.js';
import { config } from '../src/config/index.js';
import { fileLogger } from '../src/storage/fileLogger.js';

const DEMO_PORT = config.port;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function printSection(title) {
  console.log('\n\x1b[36m' + '='.repeat(68) + '\x1b[0m');
  console.log(`\x1b[1m\x1b[33m▶ ${title}\x1b[0m`);
  console.log('\x1b[36m' + '-'.repeat(68) + '\x1b[0m');
}

function connectClient(name, colorCode) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${DEMO_PORT}`);
    ws.name = name;
    ws.color = colorCode;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'channel_message') {
          console.log(
            `  \x1b[90m[#${msg.channel}]\x1b[0m ${ws.color}[${ws.name}'s Terminal]\x1b[0m \x1b[1m${msg.sender.username}\x1b[0m: ${msg.content} \x1b[90m(tx: ${msg.transactionId.substring(0, 8)}...)\x1b[0m`
          );
        } else if (msg.type === 'direct_message') {
          console.log(
            `  \x1b[35m[DIRECT MESSAGE]\x1b[0m ${ws.color}[${ws.name}'s Terminal]\x1b[0m From \x1b[1m${msg.from.username}\x1b[0m: "${msg.content}"`
          );
        }
      } catch {}
    });

    ws.on('open', () => resolve(ws));
  });
}

async function runDemo() {
  console.log('\n\x1b[32m====================================================================\x1b[0m');
  console.log('\x1b[1m  WEBSOCKET REAL-TIME COMMUNICATION HUB - LIVE CLI SIMULATION\x1b[0m');
  console.log('\x1b[32m====================================================================\x1b[0m');

  await sleep(400);

  // 1. Diagnostics & Health
  printSection('1. SERVER DIAGNOSTICS & ACTIVE CACHE STATUS');
  const healthRes = await fetch(`http://localhost:${DEMO_PORT}/health`);
  console.log(JSON.stringify(await healthRes.json(), null, 2));

  // 2. Connect Two Concurrent Terminal Clients
  printSection('2. CLIENT CONNECTION & AUTHENTICATION');
  const alice = await connectClient('Alice', '\x1b[32m');
  const bob = await connectClient('Bob', '\x1b[34m');

  alice.send(JSON.stringify({ type: 'auth', userId: 'usr-101', username: 'Alice (Lead Eng)' }));
  bob.send(JSON.stringify({ type: 'auth', userId: 'usr-202', username: 'Bob (DevOps)' }));
  await sleep(300);

  // 3. Channel Joining
  printSection('3. CHANNEL SUBSCRIPTION: #engineering');
  alice.send(JSON.stringify({ type: 'join', channel: 'engineering' }));
  bob.send(JSON.stringify({ type: 'join', channel: 'engineering' }));
  await sleep(300);

  // 4. Live Full-Duplex Real-Time Chat
  printSection('4. LIVE REAL-TIME FULL-DUPLEX MESSAGE EXCHANGE');
  alice.send(JSON.stringify({ type: 'message', channel: 'engineering', content: 'Database migration completed. Standby for deployment.' }));
  await sleep(350);
  bob.send(JSON.stringify({ type: 'message', channel: 'engineering', content: 'Acknowledged! Monitoring error rates and message queues now.' }));
  await sleep(350);
  alice.send(JSON.stringify({ type: 'message', channel: 'engineering', content: 'All services green. Zero packet drops observed.' }));
  await sleep(350);

  // 5. Direct Private Messaging
  printSection('5. DIRECT PRIVATE MESSAGING BETWEEN CLIENTS');
  bob.send(JSON.stringify({ type: 'direct', recipientUserId: 'usr-101', content: 'Great job on the release, Alice!' }));
  await sleep(350);

  // 6. Inspect Active Users & Cache Metrics
  printSection('6. IN-MEMORY / REDIS USER CACHE & CHANNEL STATS');
  const statsRes = await fetch(`http://localhost:${DEMO_PORT}/stats`);
  console.log(JSON.stringify(await statsRes.json(), null, 2));

  // 7. Inspect Persistent Disk Transaction Logs
  printSection('7. PERSISTENT TRANSACTION LOG AUDIT TRAIL (FROM DISK)');
  const recentLogs = await fileLogger.getRecentTransactions(4);
  console.log(JSON.stringify(recentLogs, null, 2));

  console.log('\n\x1b[32m✔ Live WebSocket simulation completed successfully!\x1b[0m\n');

  alice.close();
  bob.close();
  server.close();
  process.exit(0);
}

runDemo().catch((err) => {
  console.error('\x1b[31m[Demo Fatal]:\x1b[0m', err);
  process.exit(1);
});
