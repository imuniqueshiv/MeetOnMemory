/**
 * AI Meeting Summary Caching Service
 * 
 * Provides caching for AI-generated meeting summaries with:
 * - Redis-based caching with TTL
 * - Stale-while-revalidate pattern
 * - Batch processing for multiple meetings
 * - Cache invalidation on meeting updates
 */

import crypto from "crypto";

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const CACHE_CONFIG = {
  // How long to keep summaries in cache (24 hours)
  TTL_SECONDS: 60 * 60 * 24,
  
  // How long to serve stale data while refreshing (7 days)
  STALE_TTL_SECONDS: 60 * 60 * 24 * 7,
  
  // Maximum number of summaries to batch process at once
  BATCH_SIZE: 10,
  
  // Minimum time between regenerations (5 minutes)
  MIN_REGEN_INTERVAL: 5 * 60,
};

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

const generateCacheKey = (meetingId, options = {}) => {
  const base = `summary:${meetingId}`;
  
  // Include options like language, format, etc.
  const optionString = Object.keys(options)
    .sort()
    .map(key => `${key}:${options[key]}`)
    .join('|');
  
  if (optionString) {
    const hash = crypto
      .createHash('md5')
      .update(optionString)
      .digest('hex')
      .slice(0, 8);
    return `${base}:${hash}`;
  }
  
  return base;
};

const generateBatchKey = (meetingIds) => {
  const sorted = [...meetingIds].sort();
  const hash = crypto
    .createHash('md5')
    .update(sorted.join('|'))
    .digest('hex')
    .slice(0, 12);
  return `batch:summary:${hash}`;
};

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

// In-memory fallback cache (used when Redis is unavailable)
let memoryCache = new Map();

const getFromRedis = async (key) => {
  try {
    const { getRedisManager } = await import("../config/redis.js");
    const redis = getRedisManager();
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    // Fallback to memory cache
    console.warn(`Redis get failed for ${key}:`, error.message);
    return memoryCache.get(key) || null;
  }
};

const setToRedis = async (key, value, ttl) => {
  try {
    const { getRedisManager } = await import("../config/redis.js");
    const redis = getRedisManager();
    await redis.set(key, JSON.stringify(value), ttl);
  } catch (error) {
    // Fallback to memory cache
    console.warn(`Redis set failed for ${key}:`, error.message);
    memoryCache.set(key, value);
  }
};

const deleteFromRedis = async (key) => {
  try {
    const { getRedisManager } = await import("../config/redis.js");
    const redis = getRedisManager();
    await redis.delete(key);
  } catch (error) {
    console.warn(`Redis delete failed for ${key}:`, error.message);
    memoryCache.delete(key);
  }
};

// ============================================================================
// MAIN CACHE SERVICE
// ============================================================================

export const SummaryCacheService = {
  /**
   * Get a cached summary
   */
  async get(meetingId, options = {}) {
    const key = generateCacheKey(meetingId, options);
    return getFromRedis(key);
  },

  /**
   * Store a summary in cache
   */
  async set(meetingId, summary, options = {}) {
    const key = generateCacheKey(meetingId, options);
    
    const cacheData = {
      summary,
      generatedAt: new Date().toISOString(),
      meetingId,
      options,
    };
    
    await setToRedis(key, cacheData, CACHE_CONFIG.TTL_SECONDS);
    return true;
  },

  /**
   * Get a summary with stale-while-revalidate
   * Returns cached summary if available, and triggers background refresh if needed
   */
  async getWithStale(meetingId, options = {}, regenerateFn) {
    const key = generateCacheKey(meetingId, options);
    const cached = await getFromRedis(key);
    
    // If cache exists and is fresh
    if (cached) {
      const age = Date.now() - new Date(cached.generatedAt).getTime();
      const ageSeconds = age / 1000;
      
      // If fresh, return immediately
      if (ageSeconds < CACHE_CONFIG.TTL_SECONDS) {
        return {
          fromCache: true,
          fresh: true,
          data: cached.summary,
        };
      }
      
      // If stale but within stale TTL, return stale and trigger refresh
      if (ageSeconds < CACHE_CONFIG.STALE_TTL_SECONDS) {
        // Trigger background refresh (don't await)
        if (regenerateFn) {
          setImmediate(async () => {
            try {
              const freshSummary = await regenerateFn(meetingId, options);
              await this.set(meetingId, freshSummary, options);
              console.log(`🔄 Background refresh completed for meeting ${meetingId}`);
            } catch (error) {
              console.error(`Background refresh failed for ${meetingId}:`, error);
            }
          });
        }
        
        return {
          fromCache: true,
          fresh: false,
          refreshing: true,
          data: cached.summary,
        };
      }
    }
    
    // No cache or expired, generate new
    if (regenerateFn) {
      const freshSummary = await regenerateFn(meetingId, options);
      await this.set(meetingId, freshSummary, options);
      return {
        fromCache: false,
        fresh: true,
        data: freshSummary,
      };
    }
    
    return null;
  },

  /**
   * Invalidate cache for a meeting
   */
  async invalidate(meetingId, options = {}) {
    const key = generateCacheKey(meetingId, options);
    await deleteFromRedis(key);
    return true;
  },

  /**
   * Invalidate all caches for a meeting (by pattern)
   */
  async invalidateAll(meetingId) {
    // Since we can't pattern-delete easily, we'll use a version key
    const versionKey = `summary:version:${meetingId}`;
    const newVersion = Date.now().toString();
    await setToRedis(versionKey, newVersion, CACHE_CONFIG.TTL_SECONDS * 30);
    return true;
  },

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const { getRedisManager } = await import("../config/redis.js");
      const redis = getRedisManager();
      const status = redis.getStatus();
      
      return {
        redisConnected: status.isConnected,
        usingFallback: status.useFallback,
        ttlSeconds: CACHE_CONFIG.TTL_SECONDS,
        staleTtlSeconds: CACHE_CONFIG.STALE_TTL_SECONDS,
        batchSize: CACHE_CONFIG.BATCH_SIZE,
      };
    } catch (error) {
      return {
        redisConnected: false,
        usingFallback: true,
        ttlSeconds: CACHE_CONFIG.TTL_SECONDS,
        staleTtlSeconds: CACHE_CONFIG.STALE_TTL_SECONDS,
        batchSize: CACHE_CONFIG.BATCH_SIZE,
        error: error.message,
      };
    }
  },
};

// ============================================================================
// BATCH PROCESSING
// ============================================================================

export const BatchSummaryService = {
  /**
   * Generate summaries for multiple meetings in batch
   */
  async batchGenerate(meetingIds, generateFn, options = {}) {
    if (!meetingIds || meetingIds.length === 0) {
      return [];
    }
    
    // Check if any are cached first
    const results = [];
    const uncached = [];
    
    for (const meetingId of meetingIds) {
      const cached = await SummaryCacheService.get(meetingId, options);
      if (cached) {
        results.push({
          meetingId,
          summary: cached.summary,
          fromCache: true,
        });
      } else {
        uncached.push(meetingId);
      }
    }
    
    // If none need generation, return cached results
    if (uncached.length === 0) {
      return results;
    }
    
    // Process uncached meetings in batches
    const batchSize = options.batchSize || CACHE_CONFIG.BATCH_SIZE;
    const batches = [];
    for (let i = 0; i < uncached.length; i += batchSize) {
      batches.push(uncached.slice(i, i + batchSize));
    }
    
    console.log(`📦 Batch processing ${uncached.length} meetings in ${batches.length} batches`);
    
    // Process each batch
    let batchIndex = 0;
    for (const batch of batches) {
      batchIndex++;
      console.log(`📦 Processing batch ${batchIndex}/${batches.length} (${batch.length} meetings)`);
      
      try {
        // Generate summaries for this batch
        const batchResults = await generateFn(batch, options);
        
        // Cache each result
        for (const item of batchResults) {
          await SummaryCacheService.set(item.meetingId, item.summary, options);
          results.push({
            meetingId: item.meetingId,
            summary: item.summary,
            fromCache: false,
          });
        }
      } catch (error) {
        console.error(`Batch ${batchIndex} failed:`, error);
        // Don't fail the whole process, try the next batch
      }
    }
    
    return results;
  },

  /**
   * Get cached summaries for multiple meetings
   */
  async batchGet(meetingIds, options = {}) {
    const results = [];
    const missing = [];
    
    for (const meetingId of meetingIds) {
      const cached = await SummaryCacheService.get(meetingId, options);
      if (cached) {
        results.push({
          meetingId,
          summary: cached.summary,
          fromCache: true,
        });
      } else {
        missing.push(meetingId);
        results.push({
          meetingId,
          summary: null,
          fromCache: false,
        });
      }
    }
    
    return {
      results,
      missing,
      hitRate: (results.length - missing.length) / results.length,
    };
  },

  /**
   * Generate a batch cache key
   */
  getBatchKey(meetingIds) {
    return generateBatchKey(meetingIds);
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  SummaryCacheService,
  BatchSummaryService,
};