/**
 * Issue #1068 — the search cache tenant boundary.
 *
 * `getOrganizationIdFromReq` used to fall back to `x-organization-id`,
 * `organization-id`, `req.body.organizationId` and `req.query.organizationId`
 * when the session had no organization on it. That value became the Redis key
 * prefix, so a caller could name the partition it read from and wrote to with a
 * single request header.
 *
 * These suites pin down the two halves of the fix:
 *
 *   1. Nothing outside `req.user` can influence the cache key.
 *   2. A request the server cannot attribute to an (organization, user) pair is
 *      not cached at all — there is no shared bucket to land in.
 *
 * Plus the property that motivated adding the principal to the key material:
 * the search controllers filter rows through the caller's own memberships, so
 * two members of the same organization must not share a cache entry.
 */

import { jest } from "@jest/globals";
import * as redisService from "../services/redisService.js";
import {
  buildSearchCacheKey,
  cacheSearch,
  getOrganizationIdFromReq,
  getUserIdFromReq,
  resolveCacheTenant,
} from "../middleware/cacheMiddleware.js";

function createMockRedisClient() {
  const store = new Map();
  const sets = new Map();

  return {
    isReady: true,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async setEx(key, _seconds, value) {
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
      return sets.has(key) ? Array.from(sets.get(key)) : [];
    },
    async del(key) {
      const had = store.has(key) || sets.has(key);
      store.delete(key);
      sets.delete(key);
      return had ? 1 : 0;
    },
    async expire() {
      return 1;
    },
    _store: store,
    _sets: sets,
  };
}

/**
 * Minimal express-ish response double.
 *
 * `served` is populated by the original `json` implementation only. The
 * middleware legitimately replaces `res.json` (to populate the cache on a miss,
 * or to swallow the revalidation write on the SWR path), so assertions have to
 * read this array rather than the spy that `res.json` used to point at.
 */
const makeRes = () => {
  const served = [];
  const res = {
    statusCode: null,
    served,
    status: jest.fn(function (code) {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn(function (body) {
      served.push(body);
      return res;
    }),
    once: jest.fn(),
  };
  return res;
};

const VICTIM_ORG = "org_victim_acme";
const ATTACKER_ORG = "org_attacker_evil";
const SHARED_QUERY = "q4 revenue plan";

describe("Search cache tenant isolation (#1068)", () => {
  let mockRedis;

  beforeEach(() => {
    mockRedis = createMockRedisClient();
    redisService.overrideRedisClientForTesting(mockRedis);
  });

  afterEach(() => {
    redisService.overrideRedisClientForTesting(null);
    jest.restoreAllMocks();
  });

  describe("tenant resolution ignores client-controlled input", () => {
    it("never reads the organization from request headers", () => {
      expect(
        getOrganizationIdFromReq({
          headers: { "x-organization-id": VICTIM_ORG },
        }),
      ).toBeNull();

      expect(
        getOrganizationIdFromReq({
          headers: { "organization-id": VICTIM_ORG },
        }),
      ).toBeNull();
    });

    it("never reads the organization from the body or query string", () => {
      expect(
        getOrganizationIdFromReq({ body: { organizationId: VICTIM_ORG } }),
      ).toBeNull();

      expect(
        getOrganizationIdFromReq({ query: { organizationId: VICTIM_ORG } }),
      ).toBeNull();
    });

    it("prefers the session organization even when a header contradicts it", () => {
      const req = {
        user: { _id: "user_1", organization: ATTACKER_ORG },
        headers: { "x-organization-id": VICTIM_ORG },
        body: { organizationId: VICTIM_ORG },
        query: { organizationId: VICTIM_ORG },
      };

      expect(getOrganizationIdFromReq(req)).toBe(ATTACKER_ORG);
    });

    it("accepts a populated organization document as well as a raw id", () => {
      expect(
        getOrganizationIdFromReq({
          user: { organization: { _id: VICTIM_ORG, name: "Acme" } },
        }),
      ).toBe(VICTIM_ORG);

      expect(
        getOrganizationIdFromReq({ user: { organizationId: VICTIM_ORG } }),
      ).toBe(VICTIM_ORG);
    });

    it("treats blank and non-string session values as unresolved", () => {
      expect(
        getOrganizationIdFromReq({ user: { organization: "" } }),
      ).toBeNull();
      expect(
        getOrganizationIdFromReq({ user: { organization: "   " } }),
      ).toBeNull();
      expect(
        getOrganizationIdFromReq({ user: { organization: {} } }),
      ).toBeNull();
      expect(getOrganizationIdFromReq(null)).toBeNull();
      expect(getOrganizationIdFromReq(undefined)).toBeNull();
    });

    it("resolves the principal from _id or id, and nothing else", () => {
      expect(getUserIdFromReq({ user: { _id: "user_a" } })).toBe("user_a");
      expect(getUserIdFromReq({ user: { id: "user_b" } })).toBe("user_b");
      expect(
        getUserIdFromReq({ headers: { "x-user-id": "user_c" } }),
      ).toBeNull();
      expect(getUserIdFromReq({})).toBeNull();
    });
  });

  describe("cacheability decision", () => {
    it("is cacheable only when both organization and principal resolve", () => {
      expect(
        resolveCacheTenant({ user: { _id: "user_a", organization: "org_a" } }),
      ).toEqual({
        organizationId: "org_a",
        userId: "user_a",
        cacheable: true,
        reason: null,
      });
    });

    it("is not cacheable without a principal", () => {
      const decision = resolveCacheTenant({ user: { organization: "org_a" } });
      expect(decision.cacheable).toBe(false);
      expect(decision.reason).toBe("unauthenticated-principal");
    });

    it("is not cacheable without an organization", () => {
      const decision = resolveCacheTenant({ user: { _id: "user_a" } });
      expect(decision.cacheable).toBe(false);
      expect(decision.reason).toBe("unresolved-organization");
    });

    it("has no shared fallback bucket for unidentified callers", () => {
      const decision = resolveCacheTenant({
        headers: { "x-organization-id": "global" },
      });
      expect(decision.cacheable).toBe(false);
      expect(decision.organizationId).toBeNull();
    });
  });

  describe("middleware behaviour", () => {
    it("passes through without caching when the tenant cannot be resolved", async () => {
      const req = {
        baseUrl: "/api",
        path: "/search",
        body: { query: SHARED_QUERY },
        headers: { "x-organization-id": VICTIM_ORG },
        user: { role: "member" }, // authenticated, but no org and no id
      };
      const res = makeRes();
      const next = jest.fn();

      await cacheSearch(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.served).toEqual([]);
      expect(req.cacheKey).toBeUndefined();
      // Nothing was written anywhere in Redis.
      expect(mockRedis._store.size).toBe(0);
    });

    it("does not let a spoofed header read a victim's cached results", async () => {
      // 1. The victim runs a search; the response lands in their partition.
      const victimReq = {
        baseUrl: "/api",
        path: "/search",
        body: { query: SHARED_QUERY },
        user: { _id: "user_victim", organization: VICTIM_ORG },
      };
      const victimRes = makeRes();
      await cacheSearch(victimReq, victimRes, jest.fn());

      const victimPayload = {
        success: true,
        results: ["confidential-meeting"],
      };
      victimRes.json(victimPayload);
      await new Promise((r) => setTimeout(r, 10));

      expect(await mockRedis.get(victimReq.cacheKey)).not.toBeNull();

      // 2. The attacker replays the identical query, claiming the victim's org.
      const attackerReq = {
        baseUrl: "/api",
        path: "/search",
        body: { query: SHARED_QUERY },
        headers: { "x-organization-id": VICTIM_ORG },
        query: { organizationId: VICTIM_ORG },
        user: { _id: "user_attacker", organization: ATTACKER_ORG },
      };
      const attackerRes = makeRes();
      const attackerNext = jest.fn();

      await cacheSearch(attackerReq, attackerRes, attackerNext);

      // The attacker gets a miss and is forwarded to the controller, which will
      // do its own org scoping. No cached payload is served.
      expect(attackerNext).toHaveBeenCalledTimes(1);
      expect(attackerRes.served).toEqual([]);
      expect(attackerReq.cacheKey).not.toBe(victimReq.cacheKey);
      expect(attackerReq.cacheKey.startsWith(`org:${ATTACKER_ORG}:`)).toBe(
        true,
      );
    });

    it("does not let a spoofed header poison a victim's partition", async () => {
      const attackerReq = {
        baseUrl: "/api",
        path: "/search",
        body: { query: SHARED_QUERY },
        headers: { "x-organization-id": VICTIM_ORG },
        user: { _id: "user_attacker", organization: ATTACKER_ORG },
      };
      const attackerRes = makeRes();

      await cacheSearch(attackerReq, attackerRes, jest.fn());
      attackerRes.json({ success: true, results: ["attacker-controlled"] });
      await new Promise((r) => setTimeout(r, 10));

      // Everything written belongs to the attacker's own org, key and tag set.
      const writtenKeys = Array.from(mockRedis._store.keys()).filter(
        (k) => !k.startsWith("lock:"),
      );
      expect(writtenKeys.length).toBeGreaterThan(0);
      writtenKeys.forEach((key) => {
        expect(key.startsWith(`org:${ATTACKER_ORG}:`)).toBe(true);
      });

      expect(await redisService.getOrgKeys(VICTIM_ORG)).toEqual([]);
      expect(await redisService.getOrgKeys(ATTACKER_ORG)).toEqual(writtenKeys);
    });

    it("separates two members of the same organization", async () => {
      // `semanticSearch` filters through the caller's own Membership documents
      // and `uploadedBy`, so an org-wide key would serve one member's rows to
      // another.
      const alice = {
        baseUrl: "/api",
        path: "/search",
        body: { query: SHARED_QUERY },
        user: { _id: "user_alice", organization: VICTIM_ORG },
      };
      const bob = {
        baseUrl: "/api",
        path: "/search",
        body: { query: SHARED_QUERY },
        user: { _id: "user_bob", organization: VICTIM_ORG },
      };

      await cacheSearch(alice, makeRes(), jest.fn());
      await cacheSearch(bob, makeRes(), jest.fn());

      expect(alice.cacheKey).not.toBe(bob.cacheKey);
      // Both still live under the org prefix, so org-wide invalidation reaches
      // them both.
      expect(alice.cacheKey.startsWith(`org:${VICTIM_ORG}:`)).toBe(true);
      expect(bob.cacheKey.startsWith(`org:${VICTIM_ORG}:`)).toBe(true);
    });

    it("keeps distinct routes and options in distinct entries", async () => {
      const base = {
        organizationId: VICTIM_ORG,
        userId: "user_alice",
        query: SHARED_QUERY,
        options: {},
      };

      const search = buildSearchCacheKey({ ...base, route: "/api/search" });
      const hybrid = buildSearchCacheKey({
        ...base,
        route: "/api/search/hybrid",
      });
      const weighted = buildSearchCacheKey({
        ...base,
        route: "/api/search",
        options: { semanticWeight: 0.8 },
      });

      expect(new Set([search, hybrid, weighted]).size).toBe(3);
    });

    it("normalizes query casing and surrounding whitespace", async () => {
      const base = {
        organizationId: VICTIM_ORG,
        userId: "user_alice",
        route: "/api/search",
        options: {},
      };

      expect(
        buildSearchCacheKey({ ...base, query: "  Q4 Revenue Plan " }),
      ).toBe(buildSearchCacheKey({ ...base, query: "q4 revenue plan" }));
    });

    it("fails open when Redis is unavailable", async () => {
      redisService.overrideRedisClientForTesting({ isReady: false });

      const req = {
        baseUrl: "/api",
        path: "/search",
        body: { query: SHARED_QUERY },
        user: { _id: "user_alice", organization: VICTIM_ORG },
      };
      const res = makeRes();
      const next = jest.fn();

      await cacheSearch(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.served).toEqual([]);
    });

    it("skips caching for a non-string or missing query", async () => {
      for (const body of [{}, { query: 42 }, { query: null }]) {
        const req = {
          baseUrl: "/api",
          path: "/search",
          body,
          user: { _id: "user_alice", organization: VICTIM_ORG },
        };
        const next = jest.fn();
        await cacheSearch(req, makeRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(req.cacheKey).toBeUndefined();
      }
    });

    it("does not cache an unsuccessful controller response", async () => {
      const req = {
        baseUrl: "/api",
        path: "/search",
        body: { query: SHARED_QUERY },
        user: { _id: "user_alice", organization: VICTIM_ORG },
      };
      const res = makeRes();

      await cacheSearch(req, res, jest.fn());
      res.json({ success: false, message: "upstream failure" });
      await new Promise((r) => setTimeout(r, 10));

      expect(await mockRedis.get(req.cacheKey)).toBeNull();
    });
  });
});
