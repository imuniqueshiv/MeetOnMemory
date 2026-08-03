import {
  getRedisClient,
  acquireLock,
  releaseLock,
  setSearchCache,
} from "../services/redisService.js";
import crypto from "crypto";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Search cache partitioning (Issue #1068)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The cache key is the *only* thing separating one tenant's search results from
 * another's, so everything that feeds into it has to come from state the server
 * established itself.
 *
 * The previous `getOrganizationIdFromReq` fell back to `x-organization-id`,
 * `organization-id`, `req.body.organizationId` and `req.query.organizationId`
 * when `req.user.organization` was missing. `requirePermission()` — the only
 * guard in front of `cacheSearch` on the search routes — checks `req.user.role`
 * and never requires an organization, so any authenticated caller without a
 * resolved org reached this middleware and got to name its own cache partition
 * with a header. That is both a read (serve the victim's cached payload before
 * the controller ever runs) and a write (poison the victim's partition).
 *
 * Two rules follow, and they are the whole design:
 *
 *   1. Tenant identity comes from `req.user` only. Never from headers, body or
 *      query — those are attacker-controlled on every request.
 *   2. If the server cannot establish who the caller is, the request is simply
 *      not cached. There is no shared "global" bucket to fall into, because a
 *      bucket every unidentified caller shares is a cross-tenant channel by
 *      construction.
 *
 * Rule 2 replaces the old `"global"` default. Skipping the cache costs a cache
 * miss; sharing a partition costs a data leak.
 */

/** Sentinel returned when no trustworthy tenant identity exists on the request. */
export const UNRESOLVED_TENANT = null;

/**
 * Normalizes an id that may arrive as an ObjectId, a populated document, or a
 * string. Returns null for anything that isn't usable as key material.
 */
const normalizeId = (value) => {
  if (value === null || value === undefined) return null;

  // Populated ref — e.g. `req.user.organization` after `.populate()`.
  if (typeof value === "object") {
    if (value._id !== undefined && value._id !== null) {
      return normalizeId(value._id);
    }
    if (typeof value.toString === "function") {
      const asString = value.toString();
      // A plain object stringifies to "[object Object]" — not an id.
      return asString === "[object Object]" ? null : asString.trim() || null;
    }
    return null;
  }

  const asString = String(value).trim();
  return asString.length > 0 ? asString : null;
};

/**
 * Resolves the organization the *server* believes this request belongs to.
 *
 * Only `req.user` is consulted, because only `req.user` is populated by
 * `userAuth` from a verified session. Returns `UNRESOLVED_TENANT` (null) when no
 * organization is attached to the session — callers must treat that as
 * "not cacheable", not as a default bucket.
 */
export const getOrganizationIdFromReq = (req) => {
  if (!req || typeof req !== "object") return UNRESOLVED_TENANT;

  const user = req.user;
  if (!user || typeof user !== "object") return UNRESOLVED_TENANT;

  return (
    normalizeId(user.organization) ??
    normalizeId(user.organizationId) ??
    UNRESOLVED_TENANT
  );
};

/**
 * Resolves the authenticated principal — again from `req.user` only.
 *
 * The org alone is not a sufficient partition for these routes. `semanticSearch`
 * filters its results through the caller's own `Membership` documents and
 * `uploadedBy`, and `federatedSearch` scopes by `req.user._id`, so two members
 * of the same organization legitimately see different rows for the same query.
 * Keying only by org would serve one member's rows to another.
 */
export const getUserIdFromReq = (req) => {
  if (!req || typeof req !== "object") return UNRESOLVED_TENANT;

  const user = req.user;
  if (!user || typeof user !== "object") return UNRESOLVED_TENANT;

  return normalizeId(user._id) ?? normalizeId(user.id) ?? UNRESOLVED_TENANT;
};

/**
 * Full cache-partition decision for a request.
 *
 * @returns {{organizationId: string|null, userId: string|null,
 *            cacheable: boolean, reason: string|null}}
 */
export const resolveCacheTenant = (req) => {
  const organizationId = getOrganizationIdFromReq(req);
  const userId = getUserIdFromReq(req);

  if (!userId) {
    return {
      organizationId,
      userId,
      cacheable: false,
      reason: "unauthenticated-principal",
    };
  }

  if (!organizationId) {
    return {
      organizationId,
      userId,
      cacheable: false,
      reason: "unresolved-organization",
    };
  }

  return { organizationId, userId, cacheable: true, reason: null };
};

/**
 * Builds the Redis key for a search response.
 *
 * The org prefix stays first so `clearOrgSetAndKeys("org:<id>:search_keys")`
 * invalidation keeps working unchanged; the principal is folded into the hash
 * rather than the prefix for the same reason.
 */
export const buildSearchCacheKey = ({
  organizationId,
  userId,
  route,
  query,
  options,
}) => {
  const cachePayload = JSON.stringify({
    // Included in the hashed material as well as the prefix so a key can never
    // be reinterpreted under a different tenant even if the prefix is stripped.
    organizationId,
    userId,
    route,
    query: String(query).toLowerCase().trim(),
    options: options ?? {},
  });

  const hash = crypto.createHash("sha256").update(cachePayload).digest("hex");
  return `org:${organizationId}:search:${hash}`;
};

/**
 * Multi-tenant search caching middleware with tagging and a
 * stale-while-revalidate (SWR) read path.
 *
 * Fails open: any Redis problem falls through to `next()` so a cache outage
 * degrades latency rather than availability.
 */
export const cacheSearch = async (req, res, next) => {
  try {
    const { query, ...options } = req.body || {};
    if (!query || typeof query !== "string") {
      return next();
    }

    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      return next();
    }

    const { organizationId, userId, cacheable, reason } =
      resolveCacheTenant(req);

    if (!cacheable) {
      // Deliberately not cached — see the module header. Debug-level because a
      // request from a user mid-org-switch is normal, not an incident.
      if (process.env.NODE_ENV !== "production") {
        console.debug(
          `↩️ Search cache bypassed (${reason}) for ${req.method} ${req.originalUrl || req.url}`,
        );
      }
      return next();
    }

    const cacheKey = buildSearchCacheKey({
      organizationId,
      userId,
      route: (req.baseUrl || "") + (req.path || ""),
      query,
      options,
    });
    const lockKey = `lock:${cacheKey}`;

    req.cacheKey = cacheKey;
    req.organizationId = organizationId;

    const cachedDataStr = await redisClient.get(cacheKey);

    if (cachedDataStr) {
      let payload;
      let cachedAt = 0;
      let softTTL = 300;

      try {
        const parsed = JSON.parse(cachedDataStr);
        if (parsed && typeof parsed === "object" && "payload" in parsed) {
          payload = parsed.payload;
          cachedAt = parsed.cachedAt || 0;
          softTTL = parsed.softTTL || 300;
        } else {
          payload = parsed;
          cachedAt = Date.now(); // fallback for raw payload
        }
      } catch {
        payload = cachedDataStr;
        cachedAt = Date.now();
      }

      const isStale = Date.now() - cachedAt > softTTL * 1000;

      if (!isStale) {
        return res.status(200).json(payload);
      }

      // Stale cache hit (SWR flow).
      const lockToken = await acquireLock(lockKey, 5000);

      if (!lockToken) {
        // Another request is already revalidating this key.
        return res.status(200).json(payload);
      }

      // Serve the stale payload immediately, then revalidate in the background.
      res.status(200).json(payload);

      // The controller still runs and will call `res.json(freshData)`. Writing
      // that to the socket a second time would corrupt the response, so swap in
      // a hook that only refreshes the cache.
      //
      // The previous implementation additionally did `res.headersSent = true`.
      // `headersSent` is a getter-only accessor on ServerResponse, so that
      // assignment was silently discarded (and throws under strict mode) — it
      // never suppressed anything. Replacing `res.json` is what actually does
      // the job, so the bogus assignment is gone.
      const revalidateOnly = function (freshData) {
        if (freshData && freshData.success !== false) {
          setSearchCache(cacheKey, organizationId, freshData)
            .catch((err) =>
              console.error(
                "⚠️ SWR revalidation write failed:",
                cacheKey,
                err.message,
              ),
            )
            .finally(() => {
              releaseLock(lockKey, lockToken);
            });
        } else {
          releaseLock(lockKey, lockToken);
        }
        return this;
      };
      res.json = revalidateOnly;

      // Also release the lock if the controller errors out without ever calling
      // `res.json`, so a failed revalidation can't block the next one for the
      // full lock TTL.
      if (typeof res.once === "function") {
        res.once("close", () => {
          if (res.json === revalidateOnly) {
            releaseLock(lockKey, lockToken);
          }
        });
      }

      (globalThis.setImmediate || setTimeout)(() => {
        next();
      }, 0);
      return;
    }

    // Cache miss → acquire the lock for stampede protection.
    const lockToken = await acquireLock(lockKey, 5000);

    if (!lockToken) {
      // Another request is executing the same search; poll until it publishes.
      for (let i = 0; i < 50; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const polledStr = await redisClient.get(cacheKey);
        if (polledStr) {
          try {
            const parsed = JSON.parse(polledStr);
            const polledPayload =
              parsed.payload !== undefined ? parsed.payload : parsed;
            return res.status(200).json(polledPayload);
          } catch {
            return res.status(200).json(polledStr);
          }
        }
      }
    }

    // Lock acquired (or polling timed out) — populate the cache on the way out.
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (req.cacheKey && body && body.success !== false) {
        setSearchCache(cacheKey, organizationId, body)
          .catch((err) =>
            console.error(
              "⚠️ Search cache write failed:",
              cacheKey,
              err.message,
            ),
          )
          .finally(() => {
            if (lockToken) releaseLock(lockKey, lockToken);
          });
      } else if (lockToken) {
        releaseLock(lockKey, lockToken);
      }
      return originalJson(body);
    };

    next();
  } catch (error) {
    console.error("Redis cache error:", error);
    next();
  }
};
