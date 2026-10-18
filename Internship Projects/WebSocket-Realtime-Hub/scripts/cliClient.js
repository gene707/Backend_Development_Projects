import { WebSocket } from 'ws';
import readline from 'node:readline';
import { config } from '../src/config/index.js';

const wsUrl = `ws://localhost:${config.port}`;
console.log(`\x1b[36mConnecting to WebSocket Hub at ${wsUrl}...\x1b[0m`);

const ws = new WebSocket(wsUrl);
let currentChannel = 'general';
let username = process.argv[2] || `User_${Math.floor(Math.random() * 900 + 100)}`;
const userId = `usr-${username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

ws.on('open', () => {
  console.log(`\x1b[32m✔ Connected! Authenticating as \x1b[1m${username}\x1b[0m (ID: ${userId})...\x1b[0m`);
  ws.send(JSON.stringify({ type: 'auth', userId, username }));
});

ws.on('message', (raw) => {
  try {
    const msg = JSON.parse(raw.toString());

    if (msg.type === 'auth_success') {
      console.log(`\x1b[32m✔ Authenticated!\x1b[0m Joined default channel \x1b[33m#${currentChannel}\x1b[0m.`);
      console.log('\x1b[90mCommands: /join <channel> | /channels | /users | /dm <userId> <msg> | /quit\x1b[0m\n');
      promptUser();
    } else if (msg.type === 'channel_message') {
      process.stdout.write(`\r\x1b[K\x1b[36m[#${msg.channel}]\x1b[0m \x1b[1m${msg.sender.username}\x1b[0m: ${msg.content}\n`);
      promptUser();
    } else if (msg.type === 'direct_message') {
      process.stdout.write(`\r\x1b[K\x1b[35m[DM from ${msg.from.username}]\x1b[0m: ${msg.content}\n`);
      promptUser();
    } else if (msg.type === 'channel_joined') {
      currentChannel = msg.channel;
      console.log(`\x1b[32m✔ Switched active channel to #${currentChannel}\x1b[0m`);
      promptUser();
    } else if (msg.type === 'channels_list') {
      console.log('\x1b[33mAvailable Channels:\x1b[0m', msg.channels);
      promptUser();
    } else if (msg.type === 'users_list') {
      console.log(`\x1b[33mOnline Users (${msg.count}):\x1b[0m`, msg.users.map((u) => `${u.username} (${u.userId})`));
      promptUser();
    } else if (msg.type === 'error') {
      console.log(`\x1b[31m[Error ${msg.code}]\x1b[0m ${msg.message}`);
      promptUser();
    }
  } catch {}
});

function promptUser() {
  rl.question(`\x1b[34m[#${currentChannel}]\x1b[0m > `, (input) => {
    const text = input.trim();
    if (!text) {
      promptUser();
      return;
    }

    if (text === '/quit') {
      console.log('Disconnecting...');
      ws.close();
      rl.close();
      process.exit(0);
    } else if (text.startsWith('/join ')) {
      const target = text.replace('/join ', '').trim();
      ws.send(JSON.stringify({ type: 'join', channel: target }));
    } else if (text === '/channels') {
      ws.send(JSON.stringify({ type: 'list_channels' }));
    } else if (text === '/users') {
      ws.send(JSON.stringify({ type: 'list_users' }));
    } else if (text.startsWith('/dm ')) {
      const parts = text.split(' ');
      const targetUser = parts[1];
      const dmContent = parts.slice(2).join(' ');
      ws.send(JSON.stringify({ type: 'direct', recipientUserId: targetUser, content: dmContent }));
    } else {
      ws.send(JSON.stringify({ type: 'message', channel: currentChannel, content: text }));
    }

    promptUser();
  });
}

ws.on('close', () => {
  console.log('\x1b[33mDisconnected from server.\x1b[0m');
  rl.close();
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('\x1b[31mConnection error:\x1b[0m', err.message);
  process.exit(1);
});
