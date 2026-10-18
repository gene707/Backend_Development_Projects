import Redis from 'ioredis';
import { config } from '../config/index.js';

class UserCache {
  constructor() {
    this.redisClient = null;
    this.isRedisConnected = false;

    // High-performance In-Memory Fallback Store (Used when external Redis is offline)
    this.memoryUsers = new Map(); // userId -> userData
    this.memoryChannels = new Map(); // channelName -> Set of userIds

    this.initRedis();
  }

  initRedis() {
    if (!config.redisUrl) return;

    try {
      this.redisClient = new Redis(config.redisUrl, {
        lazyConnect: true,
        connectTimeout: 1000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Do not spam retries if redis is not running
        enableOfflineQueue: false,
      });

      this.redisClient
        .connect()
        .then(() => {
          this.isRedisConnected = true;
          console.log('\x1b[32m[UserCache]\x1b[0m Connected to external Redis instance at', config.redisUrl);
        })
        .catch(() => {
          this.isRedisConnected = false;
          console.log('\x1b[33m[UserCache]\x1b[0m Redis offline or unreachable. High-performance In-Memory Cache engaged.');
        });

      this.redisClient.on('error', () => {
        this.isRedisConnected = false;
      });
    } catch {
      this.isRedisConnected = false;
    }
  }

  getCacheType() {
    return this.isRedisConnected ? 'Redis Engine' : 'High-Performance In-Memory (Zero-Daemon Fallback)';
  }

  /**
   * Caches active user metadata.
   */
  async cacheUser(userId, data) {
    const payload = {
      ...data,
      cachedAt: new Date().toISOString(),
    };

    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.set(`user:${userId}`, JSON.stringify(payload), 'EX', 86400);
        await this.redisClient.sadd('active_users', userId);
        return;
      } catch {
        this.isRedisConnected = false;
      }
    }

    this.memoryUsers.set(userId, payload);
  }

  /**
   * Retrieves active user data by userId.
   */
  async getUser(userId) {
    if (this.isRedisConnected && this.redisClient) {
      try {
        const raw = await this.redisClient.get(`user:${userId}`);
        return raw ? JSON.parse(raw) : null;
      } catch {
        this.isRedisConnected = false;
      }
    }

    return this.memoryUsers.get(userId) || null;
  }

  /**
   * Removes user from cache on disconnect.
   */
  async removeUser(userId) {
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.del(`user:${userId}`);
        await this.redisClient.srem('active_users', userId);
        return;
      } catch {
        this.isRedisConnected = false;
      }
    }

    this.memoryUsers.delete(userId);
    // Remove user from all memory channel sets
    for (const [channel, members] of this.memoryChannels.entries()) {
      members.delete(userId);
      if (members.size === 0) {
        this.memoryChannels.delete(channel);
      }
    }
  }

  /**
   * Links user to a chat channel in cache.
   */
  async addUserToChannel(channel, userId) {
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.sadd(`channel:${channel}:users`, userId);
        return;
      } catch {
        this.isRedisConnected = false;
      }
    }

    if (!this.memoryChannels.has(channel)) {
      this.memoryChannels.set(channel, new Set());
    }
    this.memoryChannels.get(channel).add(userId);
  }

  /**
   * Removes user from a chat channel.
   */
  async removeUserFromChannel(channel, userId) {
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.srem(`channel:${channel}:users`, userId);
        return;
      } catch {
        this.isRedisConnected = false;
      }
    }

    if (this.memoryChannels.has(channel)) {
      const set = this.memoryChannels.get(channel);
      set.delete(userId);
      if (set.size === 0) {
        this.memoryChannels.delete(channel);
      }
    }
  }

  /**
   * Retrieves all user IDs active in a given channel.
   */
  async getChannelUsers(channel) {
    if (this.isRedisConnected && this.redisClient) {
      try {
        return await this.redisClient.smembers(`channel:${channel}:users`);
      } catch {
        this.isRedisConnected = false;
      }
    }

    const set = this.memoryChannels.get(channel);
    return set ? Array.from(set) : [];
  }

  /**
   * Retrieves all active users currently cached.
   */
  async getAllActiveUsers() {
    if (this.isRedisConnected && this.redisClient) {
      try {
        const userIds = await this.redisClient.smembers('active_users');
        const users = [];
        for (const uid of userIds) {
          const u = await this.getUser(uid);
          if (u) users.push(u);
        }
        return users;
      } catch {
        this.isRedisConnected = false;
      }
    }

    return Array.from(this.memoryUsers.values());
  }

  /**
   * Closes Redis connection cleanly.
   */
  async close() {
    if (this.redisClient) {
      try {
        this.redisClient.disconnect();
      } catch {}
      this.redisClient = null;
    }
  }
}

export const userCache = new UserCache();
