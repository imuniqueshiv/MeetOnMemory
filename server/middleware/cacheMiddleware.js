import {
  getRedisClient,
  acquireLock,
  releaseLock,
  setSearchCache,
} from "../services/redisService.js";
import crypto from "crypto";

/**
 * Extract organization ID from request parameters, user token, or headers.
 * Defaults to "global" if unassigned.
 */
export const getOrganizationIdFromReq = (req) => {
  if (req?.user?.organization) {
    if (
      typeof req.user.organization === "object" &&
      req.user.organization._id
    ) {
      return req.user.organization._id.toString();
    }
    return req.user.organization.toString();
  }
  if (req?.user?.organizationId) {
    return req.user.organizationId.toString();
  }
  if (req?.headers?.["x-organization-id"]) {
    return req.headers["x-organization-id"].toString();
  }
  if (req?.headers?.["organization-id"]) {
    return req.headers["organization-id"].toString();
  }
  if (req?.body?.organizationId) {
    return req.body.organizationId.toString();
  }
  if (req?.query?.organizationId) {
    return req.query.organizationId.toString();
  }
  return "global";
};

/**
 * Multi-Tenant Search Caching Middleware with Tagging & Stale-While-Revalidate (SWR) Strategy
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

    const organizationId = getOrganizationIdFromReq(req);

    // Include the route path, tenant org, and extra options in the cache key
    const cachePayload = JSON.stringify({
      route: req.baseUrl + req.path,
      query: query.toLowerCase().trim(),
      options,
    });
    const hash = crypto.createHash("sha256").update(cachePayload).digest("hex");
    const cacheKey = `org:${organizationId}:search:${hash}`;
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
        console.log(`⚡ Serving fresh Redis cache for query: "${query}"`);
        return res.status(200).json(payload);
      }

      // Stale cache hit (SWR flow)
      console.log(`⏳ Serving stale Redis cache (SWR) for query: "${query}"`);
      const lockToken = await acquireLock(lockKey, 5000);

      if (!lockToken) {
        // Background revalidation is already in progress by another concurrent request
        return res.status(200).json(payload);
      }

      // Return stale payload immediately to client
      res.status(200).json(payload);

      // Perform background revalidation asynchronously without writing duplicate HTTP headers
      res.headersSent = true;
      const originalJson = res.json;
      const swrJsonHook = function (freshData) {
        if (freshData && freshData.success !== false) {
          setSearchCache(cacheKey, organizationId, freshData).finally(() => {
            releaseLock(lockKey, lockToken);
          });
        } else {
          releaseLock(lockKey, lockToken);
        }
        return this;
      };
      if (originalJson && typeof originalJson === "function") {
        Object.setPrototypeOf(swrJsonHook, originalJson);
        Object.assign(swrJsonHook, originalJson);
      }
      res.json = swrJsonHook;

      (globalThis.setImmediate || setTimeout)(() => {
        next();
      }, 0);
      return;
    }

    // Cache Miss -> Lock acquisition for stampede protection
    const lockToken = await acquireLock(lockKey, 5000);

    if (!lockToken) {
      // Another request is executing the search query; poll Redis until cache is populated
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

    // Lock acquired (or polling timed out), hook res.json to populate Redis cache upon completion
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (req.cacheKey && body && body.success !== false) {
        setSearchCache(cacheKey, organizationId, body).finally(() => {
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
