/**
 * Redis Connection Manager with comprehensive error handling
 * Features:
 * - Connection retry with exponential backoff
 * - Fallback to in-memory cache
 * - Graceful degradation
 */

import { createClient } from "redis";

// ============================================================================
// CONFIGURATION
// ============================================================================

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retryDelay: 1000, // Initial retry delay in ms
  maxRetryDelay: 30000, // Maximum retry delay
  retryAttempts: 10, // Max retry attempts
  connectionTimeout: 10000, // Connection timeout
  enableAutoPipelining: true,
};

// ============================================================================
// IN-MEMORY FALLBACK CACHE
// ============================================================================

class InMemoryCache {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
    this._cleanupInterval = setInterval(() => this._cleanup(), 60000);
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiry && entry.expiry < now) {
        this.cache.delete(key);
        this.stats.deletes++;
      }
    }
  }

  async get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    if (entry.expiry && entry.expiry < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    this.stats.hits++;
    return entry.value;
  }

  async set(key, value, ttl = 3600) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl * 1000,
      created: Date.now(),
    });
    this.stats.sets++;
    return true;
  }

  async delete(key) {
    const result = this.cache.delete(key);
    if (result) this.stats.deletes++;
    return result;
  }

  async clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
    return true;
  }

  async exists(key) {
    return this.cache.has(key);
  }

  async keys(pattern = "*") {
    const keys = [];
    for (const key of this.cache.keys()) {
      if (pattern === "*" || key.includes(pattern.replace("*", ""))) {
        keys.push(key);
      }
    }
    return keys;
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
      size: this.cache.size,
    };
  }

  destroy() {
    clearInterval(this._cleanupInterval);
    this.cache.clear();
  }
}

// ============================================================================
// REDIS CONNECTION MANAGER
// ============================================================================

class RedisManager {
  constructor(config = REDIS_CONFIG) {
    this.config = config;
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.retryCount = 0;
    this.fallbackCache = new InMemoryCache();
    this.useFallback = false;
    this.connectionAttempts = 0;
    this.lastError = null;
    this.eventListeners = new Map();

    // Bind methods
    this._handleError = this._handleError.bind(this);
    this._handleReady = this._handleReady.bind(this);
    this._handleEnd = this._handleEnd.bind(this);
    this._handleReconnecting = this._handleReconnecting.bind(this);

    // Initialize connection
    this._initClient();
  }

  _initClient() {
    try {
      const url =
        `redis://${this.config.host}:${this.config.port}` +
        (this.config.password ? `?password=${this.config.password}` : "");

      this.client = createClient({
        url,
        socket: {
          reconnectStrategy: this._getReconnectStrategy.bind(this),
          connectTimeout: this.config.connectionTimeout,
        },
        database: this.config.db,
        enableAutoPipelining: this.config.enableAutoPipelining,
      });

      // Event handlers
      this.client.on("error", this._handleError);
      this.client.on("ready", this._handleReady);
      this.client.on("end", this._handleEnd);
      this.client.on("reconnecting", this._handleReconnecting);

      // Connect
      this._connect();
    } catch (error) {
      console.error("Failed to initialize Redis client:", error);
      this._switchToFallback("Initialization failed");
    }
  }

  _getReconnectStrategy(retries) {
    this.retryCount = retries;
    const delay = Math.min(
      this.config.retryDelay * Math.pow(2, retries),
      this.config.maxRetryDelay
    );

    if (retries >= this.config.retryAttempts) {
      console.warn(
        `Redis: Max retry attempts (${this.config.retryAttempts}) reached. Switching to fallback.`
      );
      this._switchToFallback("Max retry attempts reached");
      return false; // Stop retrying
    }

    console.info(
      `Redis: Reconnecting attempt ${retries + 1}/${this.config.retryAttempts} in ${delay}ms`
    );
    this._emitEvent("reconnecting", { retries, delay });
    return delay;
  }

  async _connect() {
    if (this.isConnecting || this.isConnected) return;

    this.isConnecting = true;
    this.connectionAttempts++;

    try {
      await this.client.connect();
      console.info("Redis: Connection established successfully");
    } catch (error) {
      console.error("Redis: Initial connection failed:", error.message);
      this._handleError(error);
    } finally {
      this.isConnecting = false;
    }
  }

  _handleError(error) {
    this.lastError = error;
    this.isConnected = false;

    if (this.useFallback) {
      console.debug("Redis error (fallback active):", error.message);
      return;
    }

    console.error("Redis error:", error.message);

    // Check if it's a fatal error
    if (
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.code === "ETIMEDOUT"
    ) {
      if (this.retryCount >= this.config.retryAttempts) {
        this._switchToFallback("Connection refused - max retries exceeded");
      }
    }

    this._emitEvent("error", { error: error.message });
  }

  _handleReady() {
    this.isConnected = true;
    this.useFallback = false;
    this.retryCount = 0;
    this.lastError = null;

    console.info("Redis: Connection ready");

    // No data migration needed - fallback cache is temporary only
    console.info("Redis: Fallback cache cleared (no migration needed)");

    this._emitEvent("ready", { connected: true });
  }

  _handleEnd() {
    this.isConnected = false;
    console.warn("Redis: Connection ended");
    this._emitEvent("end", { connected: false });
  }

  _handleReconnecting() {
    console.info("Redis: Reconnecting...");
    this._emitEvent("reconnecting", { connected: false });
  }

  _switchToFallback(reason) {
    if (this.useFallback) return;

    this.useFallback = true;
    this.isConnected = false;
    console.warn(`Redis: Switching to fallback in-memory cache. Reason: ${reason}`);
    this._emitEvent("fallback", { reason });
  }

  async _migrateFallbackData() {
    // No data migration needed - fallback cache is temporary only
    // Cache will be populated as Redis operations are performed
    console.info("Redis: Fallback cache ready (no data to migrate)");
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  async get(key) {
    if (!this.isConnected || this.useFallback) {
      return this.fallbackCache.get(key);
    }

    try {
      const value = await this.client.get(key);
      if (value === null) {
        this.fallbackCache.stats.misses++;
      }
      return value;
    } catch (error) {
      console.error(`Redis get error for key ${key}:`, error.message);
      // Fallback to in-memory cache on error
      return this.fallbackCache.get(key);
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.isConnected || this.useFallback) {
      return this.fallbackCache.set(key, value, ttl);
    }

    try {
      if (ttl > 0) {
        await this.client.set(key, value, { EX: ttl });
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error(`Redis set error for key ${key}:`, error.message);
      return this.fallbackCache.set(key, value, ttl);
    }
  }

  async delete(key) {
    if (!this.isConnected || this.useFallback) {
      return this.fallbackCache.delete(key);
    }

    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.error(`Redis delete error for key ${key}:`, error.message);
      return this.fallbackCache.delete(key);
    }
  }

  async clear() {
    if (!this.isConnected || this.useFallback) {
      return this.fallbackCache.clear();
    }

    try {
      await this.client.flushDb();
      return true;
    } catch (error) {
      console.error("Redis clear error:", error.message);
      return this.fallbackCache.clear();
    }
  }

  async exists(key) {
    if (!this.isConnected || this.useFallback) {
      return this.fallbackCache.exists(key);
    }

    try {
      return await this.client.exists(key);
    } catch (error) {
      console.error(`Redis exists error for key ${key}:`, error.message);
      return this.fallbackCache.exists(key);
    }
  }

  async keys(pattern = "*") {
    if (!this.isConnected || this.useFallback) {
      return this.fallbackCache.keys(pattern);
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error(`Redis keys error for pattern ${pattern}:`, error.message);
      return this.fallbackCache.keys(pattern);
    }
  }

  async getTTL(key) {
    if (!this.isConnected || this.useFallback) {
      return -1; // No TTL for in-memory cache
    }

    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error(`Redis TTL error for key ${key}:`, error.message);
      return -1;
    }
  }

  async increment(key, amount = 1) {
    if (!this.isConnected || this.useFallback) {
      const current = (await this.fallbackCache.get(key)) || 0;
      const newValue = parseInt(current) + amount;
      await this.fallbackCache.set(key, newValue.toString());
      return newValue;
    }

    try {
      return await this.client.incrBy(key, amount);
    } catch (error) {
      console.error(`Redis increment error for key ${key}:`, error.message);
      const current = (await this.fallbackCache.get(key)) || 0;
      const newValue = parseInt(current) + amount;
      await this.fallbackCache.set(key, newValue.toString());
      return newValue;
    }
  }

  // ========================================================================
  // STATUS & MONITORING
  // ========================================================================

  getStatus() {
    return {
      isConnected: this.isConnected,
      useFallback: this.useFallback,
      retryCount: this.retryCount,
      connectionAttempts: this.connectionAttempts,
      lastError: this.lastError ? this.lastError.message : null,
      config: {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db,
        maxRetryAttempts: this.config.retryAttempts,
      },
      fallbackStats: this.fallbackCache.getStats(),
    };
  }

  async ping() {
    if (!this.isConnected || this.useFallback) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.error("Redis ping error:", error.message);
      return false;
    }
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  _emitEvent(event, data) {
    const listeners = this.eventListeners.get(event) || [];
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  async destroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        console.error("Error during Redis cleanup:", error.message);
      }
    }
    this.fallbackCache.destroy();
    this.eventListeners.clear();
    console.info("Redis manager destroyed");
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let redisManager = null;

export function getRedisManager() {
  if (!redisManager) {
    redisManager = new RedisManager();
  }
  return redisManager;
}

export function getRedisClient() {
  return getRedisManager();
}

export default getRedisManager();