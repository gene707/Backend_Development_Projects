import crypto from 'node:crypto';
import { userCache } from '../cache/userCache.js';
import { fileLogger } from '../storage/fileLogger.js';

export class ChannelManager {
  constructor() {
    // channelName -> Set of WebSocket client instances
    this.channels = new Map();

    // Initialize default channels
    const defaultChannels = ['general', 'engineering', 'alerts', 'devops'];
    for (const ch of defaultChannels) {
      this.channels.set(ch, new Set());
    }
  }

  /**
   * Returns list of channels with subscriber counts.
   */
  getChannelsList() {
    const list = [];
    for (const [name, clients] of this.channels.entries()) {
      list.push({
        name,
        activeSubscribers: clients.size,
      });
    }
    return list;
  }

  /**
   * Subscribes a WebSocket client to a channel.
   */
  async joinChannel(channelName, client) {
    if (!channelName || typeof channelName !== 'string') return false;
    const channel = channelName.trim().toLowerCase();

    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }

    const set = this.channels.get(channel);
    set.add(client);
    client.subscriptions.add(channel);

    if (client.userId) {
      await userCache.addUserToChannel(channel, client.userId);
      await fileLogger.logTransaction({
        event: 'CHANNEL_JOIN',
        channel,
        userId: client.userId,
        username: client.username,
        metadata: { clientIp: client.ip },
      });
    }

    return true;
  }

  /**
   * Unsubscribes a WebSocket client from a channel.
   */
  async leaveChannel(channelName, client) {
    const channel = channelName.trim().toLowerCase();
    if (!this.channels.has(channel)) return false;

    const set = this.channels.get(channel);
    set.delete(client);
    client.subscriptions.delete(channel);

    if (client.userId) {
      await userCache.removeUserFromChannel(channel, client.userId);
      await fileLogger.logTransaction({
        event: 'CHANNEL_LEAVE',
        channel,
        userId: client.userId,
        username: client.username,
      });
    }

    return true;
  }

  /**
   * Broadcasts a message to all subscribers in a channel.
   */
  async broadcastToChannel(channelName, messageData, senderClient = null) {
    const channel = channelName.trim().toLowerCase();
    const subscribers = this.channels.get(channel);

    if (!subscribers || subscribers.size === 0) {
      return { deliveredCount: 0, transactionId: null };
    }

    const transactionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const outgoingPayload = JSON.stringify({
      type: 'channel_message',
      channel,
      transactionId,
      timestamp,
      sender: {
        userId: senderClient?.userId || 'SYSTEM',
        username: senderClient?.username || 'System',
      },
      content: messageData.content,
      metadata: messageData.metadata || {},
    });

    let deliveredCount = 0;
    for (const subscriber of subscribers) {
      // Check if subscriber connection is open (WebSocket.OPEN = 1)
      if (subscriber.readyState === 1) {
        subscriber.send(outgoingPayload);
        deliveredCount++;
      }
    }

    // Persist transaction timestamp and audit log
    await fileLogger.logTransaction({
      event: 'MESSAGE_BROADCAST',
      transactionId,
      channel,
      userId: senderClient?.userId || 'SYSTEM',
      username: senderClient?.username || 'System',
      metadata: {
        deliveredCount,
        contentLength: messageData.content?.length || 0,
      },
    });

    return { deliveredCount, transactionId, timestamp };
  }

  /**
   * Delivers a direct private message between two clients.
   */
  async sendDirectMessage(recipientUserId, messageData, senderClient, allClients) {
    const transactionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    let targetClient = null;
    for (const c of allClients) {
      if (c.userId === recipientUserId && c.readyState === 1) {
        targetClient = c;
        break;
      }
    }

    if (!targetClient) {
      return { success: false, message: 'Recipient is not currently online' };
    }

    const outgoingPayload = JSON.stringify({
      type: 'direct_message',
      transactionId,
      timestamp,
      from: {
        userId: senderClient.userId,
        username: senderClient.username,
      },
      content: messageData.content,
    });

    targetClient.send(outgoingPayload);

    await fileLogger.logTransaction({
      event: 'DIRECT_MESSAGE',
      transactionId,
      userId: senderClient.userId,
      username: senderClient.username,
      metadata: { recipientUserId, contentLength: messageData.content?.length || 0 },
    });

    return { success: true, transactionId, timestamp };
  }

  /**
   * Removes client from all channels upon disconnect.
   */
  async handleClientDisconnect(client) {
    for (const channel of client.subscriptions) {
      const set = this.channels.get(channel);
      if (set) {
        set.delete(client);
      }
      if (client.userId) {
        await userCache.removeUserFromChannel(channel, client.userId);
      }
    }
    client.subscriptions.clear();

    if (client.userId) {
      await fileLogger.logTransaction({
        event: 'USER_DISCONNECT',
        userId: client.userId,
        username: client.username,
        metadata: {
          uptimeSeconds: client.connectedAt ? Math.floor((Date.now() - client.connectedAt) / 1000) : 0,
        },
      });
      await userCache.removeUser(client.userId);
    }
  }
}

export const channelManager = new ChannelManager();
