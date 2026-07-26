import { createClient } from "redis";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

let redisClient = null;
let isRedisDisabled = false;

export const initRedis = async () => {
  const redisUri = process.env.REDIS_URI;

  if (!redisUri) {
    console.log("ℹ️ Redis is disabled (REDIS_URI not provided)");
    isRedisDisabled = true;
    return;
  }

  try {
    redisClient = createClient({
      url: redisUri,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.error(
              "⚠️ Redis connection failed after 3 retries. Disabling Redis.",
            );
            isRedisDisabled = true;
            return new Error("Retry limit exceeded");
          }
          return Math.min(retries * 50, 500); // Wait 50, 100, 150ms...
        },
      },
    });

    redisClient.on("error", (err) => {
      // Only log if we haven't already disabled it to prevent log spam
      if (!isRedisDisabled) {
        console.log(`⚠️ Redis Client Error: ${err.message}`);
      }
    });

    await redisClient.connect();

    const isLocal =
      redisUri.includes("localhost") || redisUri.includes("127.0.0.1");
    const connectionType = isLocal
      ? "local"
      : redisUri.includes("upstash")
        ? "Upstash"
        : "remote";

    console.log(`✅ Redis connected successfully (${connectionType})`);
  } catch (error) {
    console.error("⚠️ Redis connection failed:", error.message);
    console.warn(
      "⚠️  Server running without Redis. Rate limiting and caching will not work.",
    );
    redisClient = null; // Disable the client for subsequent requests
    isRedisDisabled = true;
  }
};

let customTestClient = null;

export const overrideRedisClientForTesting = (client) => {
  customTestClient = client;
};

export const getRedisClient = () =>
  customTestClient !== null
    ? customTestClient
    : isRedisDisabled
      ? null
      : redisClient;

export const acquireLock = async (lockKey, ttlMs = 5000) => {
  const client = getRedisClient();
  if (!client || !client.isReady) return null;
  try {
    const lockToken = crypto.randomUUID();
    const res = await client.set(lockKey, lockToken, { NX: true, PX: ttlMs });
    return res === "OK" ? lockToken : null;
  } catch (err) {
    console.error("⚠️ acquireLock error:", lockKey, err.message);
    return null;
  }
};

export const releaseLock = async (lockKey, lockToken) => {
  if (!lockToken) return false;
  const client = getRedisClient();
  if (!client || !client.isReady) return false;
  try {
    if (typeof client.eval === "function") {
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await client.eval(luaScript, {
        keys: [lockKey],
        arguments: [lockToken],
      });
    } else {
      const current = await client.get(lockKey);
      if (current === lockToken) {
        await client.del(lockKey);
      }
    }
    return true;
  } catch (err) {
    console.error("⚠️ releaseLock error:", lockKey, err.message);
    return false;
  }
};

export const setSearchCache = async (
  cacheKey,
  organizationId = "global",
  payload,
  softTTLSec = 300,
  hardTTLSec = 3600,
) => {
  const client = getRedisClient();
  if (!client || !client.isReady) return false;
  try {
    const orgId = organizationId || "global";
    const cacheValue = {
      payload,
      cachedAt: Date.now(),
      softTTL: softTTLSec,
      hardTTL: hardTTLSec,
    };
    await client.setEx(cacheKey, hardTTLSec, JSON.stringify(cacheValue));
    const setKey = `org:${orgId}:search_keys`;
    await client.sAdd(setKey, cacheKey);
    // Set 24h expiration on the org search key index set to prevent unbounded growth
    await client.expire(setKey, 86400).catch(() => {});
    return true;
  } catch (err) {
    console.error("⚠️ setSearchCache error:", cacheKey, err.message);
    return false;
  }
};

export const addKeyToOrgSet = async (organizationId = "global", cacheKey) => {
  const client = getRedisClient();
  if (!client || !client.isReady) return false;
  try {
    const orgId = organizationId || "global";
    const setKey = `org:${orgId}:search_keys`;
    await client.sAdd(setKey, cacheKey);
    await client.expire(setKey, 86400).catch(() => {});
    return true;
  } catch (err) {
    console.error("⚠️ addKeyToOrgSet error:", cacheKey, err.message);
    return false;
  }
};

export const getOrgKeys = async (organizationId = "global") => {
  const client = getRedisClient();
  if (!client || !client.isReady) return [];
  try {
    const orgId = organizationId || "global";
    const setKey = `org:${orgId}:search_keys`;
    return await client.sMembers(setKey);
  } catch (err) {
    console.error("⚠️ getOrgKeys error:", organizationId, err.message);
    return [];
  }
};

export const clearOrgSetAndKeys = async (organizationId = "global") => {
  const client = getRedisClient();
  if (!client || !client.isReady) return 0;
  try {
    const orgId = organizationId || "global";
    const setKey = `org:${orgId}:search_keys`;
    if (typeof client.eval === "function") {
      const luaScript = `
        local keys = redis.call('smembers', KEYS[1])
        local count = #keys
        if count > 0 then
          for i, key in ipairs(keys) do
            redis.call('del', key)
          end
        end
        redis.call('del', KEYS[1])
        return count
      `;
      const res = await client.eval(luaScript, { keys: [setKey] });
      return Number(res) || 0;
    } else {
      const keys = await client.sMembers(setKey);
      let deletedCount = 0;
      if (keys && keys.length > 0) {
        const multi = client.multi();
        keys.forEach((key) => multi.del(key));
        multi.del(setKey);
        await multi.exec();
        deletedCount = keys.length;
      } else {
        await client.del(setKey);
      }
      return deletedCount;
    }
  } catch (err) {
    console.error("⚠️ clearOrgSetAndKeys error:", organizationId, err.message);
    return 0;
  }
};
