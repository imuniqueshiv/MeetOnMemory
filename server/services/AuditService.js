import AuditLog from "../models/auditLogModel.js";

/**
 * Service to handle creating audit logs for administrative actions.
 */
class AuditService {
  /**
   * Log an administrative action to the database.
   * This is wrapped in a try/catch so it never crashes the main application flow.
   *
   * @param {Object} params
   * @param {String|ObjectId} params.actorId - ID of the user performing the action
   * @param {String} params.action - String describing the action (e.g. POLICY_CREATED)
   * @param {String} params.entity - Type of entity affected (e.g. Policy)
   * @param {String|ObjectId} params.entityId - ID of the entity affected
   * @param {String|ObjectId} params.organizationId - ID of the organization
   * @param {Object} [params.details] - Any extra payload (before/after states)
   */
  static async logAction({
    actorId,
    action,
    entity,
    entityId,
    organizationId,
    details = {},
  }) {
    try {
      // Input validation to avoid saving bad data
      if (!actorId || !action || !entity || !entityId || !organizationId) {
        console.warn(
          "⚠️ AuditService.logAction: Missing required fields, skipping log.",
        );
        return;
      }

      await AuditLog.create({
        actor: actorId,
        action,
        entity,
        entityId,
        organization: organizationId,
        details,
      });
    } catch (error) {
      // We explicitly catch and log this so the main API response doesn't fail
      // just because audit logging failed.
      console.error("❌ AuditService failed to write log:", error);
    }
  }
}

export default AuditService;
