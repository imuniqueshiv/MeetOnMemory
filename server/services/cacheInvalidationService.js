import eventBus from "./eventBus.js";
import { clearOrgSetAndKeys } from "./redisService.js";

/**
 * Extract organizationId from an entity object or raw ID string.
 *
 * @param {object|string|null} entity
 * @returns {string} organizationId
 */
export const extractOrgIdFromEntity = (entity) => {
  if (!entity) return "global";
  if (typeof entity === "string") return entity;

  const org = entity.organization || entity.organizationId;
  if (!org) return "global";

  if (typeof org === "object") {
    return org._id ? org._id.toString() : org.toString();
  }
  return org.toString();
};

/**
 * Invalidate all search cache keys for a given organization ID using Redis set tracking and pipeline deletion.
 *
 * @param {string|object} organizationId
 * @returns {Promise<{success: boolean, deletedCount: number, organizationId: string}>}
 */
export const invalidateOrgCache = async (organizationId) => {
  const orgId = extractOrgIdFromEntity(organizationId);
  try {
    const deletedCount = await clearOrgSetAndKeys(orgId);
    if (process.env.NODE_ENV !== "test") {
      console.log(
        `🧹 [CacheInvalidation] Cleared ${deletedCount} search cache keys for org: "${orgId}"`,
      );
    }
    return { success: true, deletedCount, organizationId: orgId };
  } catch (error) {
    console.error(
      `⚠️ [CacheInvalidation] Failed to invalidate cache for org: "${orgId}":`,
      error.message,
    );
    return {
      success: false,
      deletedCount: 0,
      organizationId: orgId,
      error: error.message,
    };
  }
};

/**
 * Register eventBus listeners for automatic cache eviction on entity mutations.
 */
export const registerCacheInvalidationListeners = () => {
  const mutationEvents = [
    "meeting.created",
    "meeting.updated",
    "meeting.deleted",
    "policy.updated",
    "policy.deleted",
    "mom.generated",
  ];

  mutationEvents.forEach((eventType) => {
    eventBus.on(eventType, async (entityPayload) => {
      if (process.env.NODE_ENV !== "test") {
        console.log(`📡 [CacheInvalidation] Event triggered: "${eventType}"`);
      }
      await invalidateOrgCache(entityPayload);
    });
  });

  if (process.env.NODE_ENV !== "test") {
    console.log(
      `✅ [CacheInvalidation] Registered eventBus listeners for search cache eviction.`,
    );
  }
};

// Automatically register listeners upon module import
registerCacheInvalidationListeners();

export default {
  invalidateOrgCache,
  extractOrgIdFromEntity,
  registerCacheInvalidationListeners,
};
