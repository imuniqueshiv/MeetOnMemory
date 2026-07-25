import { jest } from "@jest/globals";
import eventBus from "../services/eventBus.js";
import * as redisService from "../services/redisService.js";
import { invalidateOrgCache } from "../services/cacheInvalidationService.js";
import {
  cacheSearch,
  getOrganizationIdFromReq,
} from "../middleware/cacheMiddleware.js";

// Helper to construct an in-memory Redis client mock
function createMockRedisClient() {
  const store = new Map();
  const sets = new Map();

  return {
    isReady: true,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async setEx(key, seconds, value) {
      store.set(key, value);
      return "OK";
    },
    async set(key, value, opts) {
      if (opts && opts.NX) {
        if (store.has(key)) return null;
        store.set(key, value);
        return "OK";
      }
      store.set(key, value);
      return "OK";
    },
    async sAdd(key, member) {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key).add(member);
      return 1;
    },
    async sMembers(key) {
      if (!sets.has(key)) return [];
      return Array.from(sets.get(key));
    },
    async del(key) {
      if (Array.isArray(key)) {
        key.forEach((k) => {
          store.delete(k);
          sets.delete(k);
        });
        return key.length;
      }
      const had = store.has(key) || sets.has(key);
      store.delete(key);
      sets.delete(key);
      return had ? 1 : 0;
    },
    multi() {
      const ops = [];
      const self = this;
      return {
        del(key) {
          ops.push(() => self.del(key));
          return this;
        },
        async exec() {
          for (const op of ops) {
            await op();
          }
          return [];
        },
      };
    },
    _store: store,
    _sets: sets,
  };
}

describe("Multi-Tenant Cache Invalidation & SWR System", () => {
  let mockRedis;

  beforeEach(() => {
    mockRedis = createMockRedisClient();
    redisService.overrideRedisClientForTesting(mockRedis);
  });

  afterEach(() => {
    redisService.overrideRedisClientForTesting(null);
    jest.restoreAllMocks();
  });

  describe("1. Organization Extraction & Key Isolation", () => {
    it("should correctly extract organizationId from user object, headers, body, or fallback", () => {
      expect(
        getOrganizationIdFromReq({ user: { organization: "org_user_123" } }),
      ).toBe("org_user_123");

      expect(
        getOrganizationIdFromReq({
          user: { organization: { _id: "org_obj_456" } },
        }),
      ).toBe("org_obj_456");

      expect(
        getOrganizationIdFromReq({
          headers: { "x-organization-id": "org_hdr_789" },
        }),
      ).toBe("org_hdr_789");

      expect(
        getOrganizationIdFromReq({ body: { organizationId: "org_body_101" } }),
      ).toBe("org_body_101");

      expect(getOrganizationIdFromReq({})).toBe("global");
    });

    it("should generate organization-scoped cache keys for identical search queries", async () => {
      const req1 = {
        baseUrl: "/api",
        path: "/search",
        body: { query: "quarterly financial report" },
        user: { organization: "org_alpha" },
      };
      const res1 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next1 = jest.fn();

      await cacheSearch(req1, res1, next1);

      expect(req1.cacheKey).toMatch(/^org:org_alpha:search:[a-f0-9]{64}$/);
      expect(req1.organizationId).toBe("org_alpha");

      const req2 = {
        baseUrl: "/api",
        path: "/search",
        body: { query: "quarterly financial report" },
        user: { organization: "org_beta" },
      };
      const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next2 = jest.fn();

      await cacheSearch(req2, res2, next2);

      expect(req2.cacheKey).toMatch(/^org:org_beta:search:[a-f0-9]{64}$/);
      expect(req2.cacheKey).not.toBe(req1.cacheKey);
    });
  });

  describe("2. Tag-Based Key Storage & Invalidation Engine", () => {
    it("should index search keys in Redis set and clear them on invalidateOrgCache", async () => {
      const orgId = "org_acme";
      const key1 = `org:${orgId}:search:hash1`;
      const key2 = `org:${orgId}:search:hash2`;

      await redisService.setSearchCache(key1, orgId, { data: "result1" });
      await redisService.setSearchCache(key2, orgId, { data: "result2" });

      const keysBefore = await redisService.getOrgKeys(orgId);
      expect(keysBefore).toContain(key1);
      expect(keysBefore).toContain(key2);

      const invalidationResult = await invalidateOrgCache(orgId);
      expect(invalidationResult.success).toBe(true);
      expect(invalidationResult.deletedCount).toBe(2);

      const keysAfter = await redisService.getOrgKeys(orgId);
      expect(keysAfter).toEqual([]);

      const cached1 = await mockRedis.get(key1);
      const cached2 = await mockRedis.get(key2);
      expect(cached1).toBeNull();
      expect(cached2).toBeNull();
    });

    it("should isolate cache invalidation to target organizationId only", async () => {
      const orgA = "org_tenant_A";
      const orgB = "org_tenant_B";

      const keyA = `org:${orgA}:search:hashA`;
      const keyB = `org:${orgB}:search:hashB`;

      await redisService.setSearchCache(keyA, orgA, { data: "dataA" });
      await redisService.setSearchCache(keyB, orgB, { data: "dataB" });

      await invalidateOrgCache(orgA);

      expect(await mockRedis.get(keyA)).toBeNull();
      expect(await mockRedis.get(keyB)).not.toBeNull();
    });
  });

  describe("3. EventBus Invalidation Triggers", () => {
    it("should automatically invalidate org search cache on mutation events", async () => {
      const orgId = "org_events_test";
      const key = `org:${orgId}:search:test_hash`;

      const events = [
        "meeting.created",
        "meeting.updated",
        "meeting.deleted",
        "policy.updated",
        "policy.deleted",
        "mom.generated",
      ];

      for (const eventName of events) {
        await redisService.setSearchCache(key, orgId, { data: "test" });
        expect(await mockRedis.get(key)).not.toBeNull();

        eventBus.emit(eventName, { organization: orgId });

        // Wait brief tick for async eventBus listener to process
        await new Promise((r) => setTimeout(r, 20));

        expect(await mockRedis.get(key)).toBeNull();
      }
    });
  });

  describe("4. Stale-While-Revalidate (SWR) & Distributed Locking", () => {
    it("should immediately serve fresh data on cache hit without triggering revalidation", async () => {
      const orgId = "org_swr";
      const req = {
        baseUrl: "/api",
        path: "/search",
        body: { query: "security compliance policy" },
        user: { organization: orgId },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const freshPayload = { success: true, results: ["policy1"] };
      await cacheSearch(req, res, next);

      // Populate fresh cache manually via helper
      await redisService.setSearchCache(
        req.cacheKey,
        orgId,
        freshPayload,
        300,
        3600,
      );

      const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await cacheSearch(req, res2, next);

      expect(res2.status).toHaveBeenCalledWith(200);
      expect(res2.json).toHaveBeenCalledWith(freshPayload);
      expect(next).toHaveBeenCalledTimes(1); // Only called once during first cache miss check
    });

    it("should serve stale cached data immediately and acquire lock for background revalidation", async () => {
      const orgId = "org_swr_stale";
      const req = {
        baseUrl: "/api",
        path: "/search",
        body: { query: "engineering guidelines" },
        user: { organization: orgId },
      };

      const crypto = await import("crypto");
      const cachePayload = JSON.stringify({
        route: req.baseUrl + req.path,
        query: req.body.query,
        options: {},
      });
      const hash = crypto
        .createHash("sha256")
        .update(cachePayload)
        .digest("hex");
      const cacheKey = `org:${orgId}:search:${hash}`;

      const stalePayload = { success: true, results: ["old_guideline"] };
      // Save cache entry with an old timestamp (6 minutes ago, > softTTL of 300s)
      const staleCacheValue = {
        payload: stalePayload,
        cachedAt: Date.now() - 360000,
        softTTL: 300,
        hardTTL: 3600,
      };
      await mockRedis.setEx(cacheKey, 3600, JSON.stringify(staleCacheValue));
      await mockRedis.sAdd(`org:${orgId}:search_keys`, cacheKey);

      const resStale = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const nextStale = jest.fn();

      await cacheSearch(req, resStale, nextStale);

      expect(resStale.status).toHaveBeenCalledWith(200);
      expect(resStale.json).toHaveBeenCalledWith(stalePayload);

      // Lock should have been acquired for background revalidation
      const lockVal = await mockRedis.get(`lock:${cacheKey}`);
      expect(typeof lockVal).toBe("string");
      expect(lockVal.length).toBeGreaterThan(0);
    });
  });

  describe("5. Cache Stampede Protection Stress Test", () => {
    it("should allow only 1 request to acquire lock on expired cache key while others wait or receive SWR", async () => {
      const orgId = "org_stampede";
      const reqTemplate = {
        baseUrl: "/api",
        path: "/search",
        body: { query: "heavy concurrency search" },
        user: { organization: orgId },
      };

      // Populate a stale cache payload
      const cachePayload = JSON.stringify({
        route: reqTemplate.baseUrl + reqTemplate.path,
        query: reqTemplate.body.query,
        options: {},
      });
      const crypto = await import("crypto");
      const hash = crypto
        .createHash("sha256")
        .update(cachePayload)
        .digest("hex");
      const cacheKey = `org:${orgId}:search:${hash}`;

      const staleData = { success: true, results: ["heavy_result"] };
      await mockRedis.setEx(
        cacheKey,
        3600,
        JSON.stringify({
          payload: staleData,
          cachedAt: Date.now() - 400000, // 400s ago (> 300s softTTL)
          softTTL: 300,
        }),
      );

      const responses = [];

      // Simulate 50 concurrent requests hitting the stale cache key
      const concurrentRequests = Array.from({ length: 50 }).map(
        async (_, _idx) => {
          const req = { ...reqTemplate };
          const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn((body) => responses.push(body)),
          };
          const next = jest.fn();

          await cacheSearch(req, res, next);
        },
      );

      await Promise.all(concurrentRequests);

      // Verify all 50 requests received the cached payload without error
      expect(responses.length).toBe(50);
      responses.forEach((resp) => {
        expect(resp).toEqual(staleData);
      });

      // Verify distributed lock was set
      const lockState = await mockRedis.get(`lock:${cacheKey}`);
      expect(typeof lockState).toBe("string");
      expect(lockState.length).toBeGreaterThan(0);
    });
  });
});
