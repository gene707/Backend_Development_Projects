import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'node:crypto';
import { config } from './config/index.js';
import { userCache } from './cache/userCache.js';
import { fileLogger } from './storage/fileLogger.js';
import { channelManager } from './channels/channelManager.js';

// 1. Create Native HTTP Server for Diagnostics, Health & Log Audits
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Health Endpoint
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'UP',
        service: 'Concurrent WebSocket Real-Time Communication Hub',
        port: config.port,
        cacheEngine: userCache.getCacheType(),
        activeConnections: wss.clients.size,
        logStorage: fileLogger.getLogPath(),
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Active Statistics Endpoint
  if (url.pathname === '/stats' && req.method === 'GET') {
    const activeUsers = await userCache.getAllActiveUsers();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        activeClients: wss.clients.size,
        cacheEngine: userCache.getCacheType(),
        channels: channelManager.getChannelsList(),
        activeUsers,
      })
    );
    return;
  }

  // Audit Logs Endpoint
  if (url.pathname === '/logs' && req.method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const recent = await fileLogger.getRecentTransactions(limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        count: recent.length,
        logFile: fileLogger.getLogPath(),
        data: recent,
      })
    );
    return;
  }

  // Default fallback
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      service: 'WebSocket Real-Time Communication Hub',
      wsEndpoint: `ws://localhost:${config.port}`,
      httpEndpoints: ['/health', '/stats', '/logs'],
    })
  );
});

// 2. Initialize WebSocket Server
export const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // Attach state to WebSocket client
  ws.id = crypto.randomUUID();
  ws.ip = req.socket.remoteAddress || 'unknown';
  ws.isAlive = true;
  ws.connectedAt = Date.now();
  ws.userId = null;
  ws.username = null;
  ws.subscriptions = new Set();

  // Send initial handshake welcome
  ws.send(
    JSON.stringify({
      type: 'connection_established',
      connectionId: ws.id,
      timestamp: new Date().toISOString(),
      availableChannels: channelManager.getChannelsList().map((c) => c.name),
      message: 'Connected to WebSocket Real-Time Communication Hub. Send { type: "auth", userId: "...", username: "..." } to authenticate.',
    })
  );

  // Heartbeat pong listener
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Handle incoming message frames
  ws.on('message', async (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      ws.send(
        JSON.stringify({
          type: 'error',
          code: 'MALFORMED_JSON',
          message: 'Payload must be a valid JSON string',
        })
      );
      return;
    }

    const { type, channel, content, userId, username, recipientUserId } = message;

    switch (type) {
      // 1. Authenticate / Identify User
      case 'auth': {
        if (!userId || !username) {
          ws.send(
            JSON.stringify({
              type: 'error',
              code: 'INVALID_AUTH',
              message: 'Both userId and username are required for auth',
            })
          );
          return;
        }

        ws.userId = String(userId).trim();
        ws.username = String(username).trim();

        // Cache active user metadata in Redis / In-Memory cache
        await userCache.cacheUser(ws.userId, {
          userId: ws.userId,
          username: ws.username,
          ip: ws.ip,
          connectionId: ws.id,
          connectedAt: new Date(ws.connectedAt).toISOString(),
        });

        // Log transaction to persistent file
        await fileLogger.logTransaction({
          event: 'USER_CONNECT',
          userId: ws.userId,
          username: ws.username,
          metadata: { ip: ws.ip, connectionId: ws.id },
        });

        // Automatically join default 'general' channel
        await channelManager.joinChannel('general', ws);

        ws.send(
          JSON.stringify({
            type: 'auth_success',
            userId: ws.userId,
            username: ws.username,
            cacheEngine: userCache.getCacheType(),
            currentChannels: Array.from(ws.subscriptions),
          })
        );
        break;
      }

      // 2. Join a Channel
      case 'join': {
        if (!channel) {
          ws.send(JSON.stringify({ type: 'error', code: 'MISSING_CHANNEL', message: 'Channel name is required' }));
          return;
        }

        const joined = await channelManager.joinChannel(channel, ws);
        if (joined) {
          ws.send(
            JSON.stringify({
              type: 'channel_joined',
              channel: channel.toLowerCase(),
              timestamp: new Date().toISOString(),
            })
          );

          // Broadcast user arrival to the channel
          if (ws.username) {
            await channelManager.broadcastToChannel(
              channel,
              {
                content: `${ws.username} joined #${channel}`,
                metadata: { systemNotice: true },
              },
              ws
            );
          }
        }
        break;
      }

      // 3. Leave a Channel
      case 'leave': {
        if (!channel) {
          ws.send(JSON.stringify({ type: 'error', code: 'MISSING_CHANNEL', message: 'Channel name is required' }));
          return;
        }

        await channelManager.leaveChannel(channel, ws);
        ws.send(
          JSON.stringify({
            type: 'channel_left',
            channel: channel.toLowerCase(),
            timestamp: new Date().toISOString(),
          })
        );
        break;
      }

      // 4. Send Message to Channel
      case 'message': {
        if (!channel || !content) {
          ws.send(
            JSON.stringify({
              type: 'error',
              code: 'INVALID_MESSAGE',
              message: 'Both channel and content are required',
            })
          );
          return;
        }

        if (content.length > config.maxMessageLength) {
          ws.send(
            JSON.stringify({
              type: 'error',
              code: 'MESSAGE_TOO_LARGE',
              message: `Message exceeds maximum allowed length of ${config.maxMessageLength} characters`,
            })
          );
          return;
        }

        // Must be subscribed to the channel to broadcast
        const cleanChannel = channel.trim().toLowerCase();
        if (!ws.subscriptions.has(cleanChannel)) {
          ws.send(
            JSON.stringify({
              type: 'error',
              code: 'NOT_SUBSCRIBED',
              message: `You must join #${cleanChannel} before posting messages to it`,
            })
          );
          return;
        }

        const result = await channelManager.broadcastToChannel(cleanChannel, { content }, ws);

        ws.send(
          JSON.stringify({
            type: 'message_ack',
            transactionId: result.transactionId,
            channel: cleanChannel,
            deliveredCount: result.deliveredCount,
            timestamp: result.timestamp,
          })
        );
        break;
      }

      // 5. Direct Private Message
      case 'direct': {
        if (!recipientUserId || !content) {
          ws.send(
            JSON.stringify({
              type: 'error',
              code: 'INVALID_DIRECT_MESSAGE',
              message: 'Both recipientUserId and content are required',
            })
          );
          return;
        }

        const result = await channelManager.sendDirectMessage(recipientUserId, { content }, ws, wss.clients);

        ws.send(
          JSON.stringify({
            type: 'direct_message_ack',
            ...result,
          })
        );
        break;
      }

      // 6. List Channels
      case 'list_channels': {
        ws.send(
          JSON.stringify({
            type: 'channels_list',
            channels: channelManager.getChannelsList(),
          })
        );
        break;
      }

      // 7. List Active Users
      case 'list_users': {
        const users = await userCache.getAllActiveUsers();
        ws.send(
          JSON.stringify({
            type: 'users_list',
            count: users.length,
            users,
          })
        );
        break;
      }

      // 8. Ping / Heartbeat
      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      }

      default: {
        ws.send(
          JSON.stringify({
            type: 'error',
            code: 'UNKNOWN_TYPE',
            message: `Unknown event type: '${type}'`,
          })
        );
      }
    }
  });

  // Handle client disconnection
  ws.on('close', async () => {
    await channelManager.handleClientDisconnect(ws);
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket Client Error] Client ${ws.id}:`, err.message);
  });
});

// 3. Heartbeat / Dead-connection Pruning Interval
const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log(`\x1b[33m[Heartbeat]\x1b[0m Terminating inactive client: ${ws.id}`);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, config.heartbeatIntervalMs);

wss.on('close', () => {
  clearInterval(heartbeatTimer);
});

// 4. Start Server
server.listen(config.port, () => {
  console.log('\n\x1b[36m====================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[32m [ONLINE] Concurrent WebSocket Real-Time Communication Hub\x1b[0m');
  console.log('\x1b[36m====================================================================\x1b[0m');
  console.log(` \x1b[33mEnvironment:\x1b[0m        ${config.env}`);
  console.log(` \x1b[33mWebSocket Endpoint:\x1b[0m ws://localhost:${config.port}`);
  console.log(` \x1b[33mHealth & Diagnostics:\x1b[0m http://localhost:${config.port}/health`);
  console.log(` \x1b[33mStatistics Endpoint:\x1b[0m http://localhost:${config.port}/stats`);
  console.log(` \x1b[33mPersistent Logs:\x1b[0m     http://localhost:${config.port}/logs`);
  console.log(` \x1b[33mCache Engine:\x1b[0m        ${userCache.getCacheType()}`);
  console.log(` \x1b[33mLog Storage File:\x1b[0m    ${fileLogger.getLogPath()}`);
  console.log('\x1b[36m--------------------------------------------------------------------\x1b[0m');
  console.log(' Ready for high-concurrency real-time WebSocket pipelines.\n');
});

// Graceful Shutdown
const shutdown = async () => {
  console.log('\n\x1b[33m[Server]\x1b[0m Shutting down WebSocket hub gracefully...');
  clearInterval(heartbeatTimer);
  wss.clients.forEach((c) => c.close(1001, 'Server shutting down'));
  await userCache.close();
  server.close(() => {
    console.log('\x1b[32m[Server]\x1b[0m Clean shutdown complete.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default server;
