import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  ROLE_HIERARCHY,
  hasPermission,
  hasHigherOrEqualRole,
  isValidRole,
} from "../rbacPermissions";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Parse ROLE_HIERARCHY / PERMISSIONS object literals from the server mirror
 * without executing server code (keeps the client test self-contained).
 */
const loadServerPermissionExports = () => {
  const serverPath = resolve(
    __dirname,
    "../../../../server/utils/rbacPermissions.js",
  );
  const source = readFileSync(serverPath, "utf8");

  const hierarchyMatch = source.match(
    /export const ROLE_HIERARCHY = (\{[\s\S]*?\n\});/,
  );
  const permissionsMatch = source.match(
    /export const PERMISSIONS = (\{[\s\S]*?\n\});/,
  );

  if (!hierarchyMatch || !permissionsMatch) {
    throw new Error("Unable to parse server rbacPermissions.js exports");
  }

  // Object literals only — no functions — so Function() is safe here.
  const ROLE_HIERARCHY_SERVER = new Function(`return (${hierarchyMatch[1]})`)();
  const PERMISSIONS_SERVER = new Function(`return (${permissionsMatch[1]})`)();

  return {
    ROLE_HIERARCHY: ROLE_HIERARCHY_SERVER,
    PERMISSIONS: PERMISSIONS_SERVER,
  };
};

describe("RBAC Permissions Utils", () => {
  describe("hasPermission", () => {
    it("returns true if role has permission for action on resource", () => {
      expect(hasPermission("owner", "meetings", "delete")).toBe(true);
      expect(hasPermission("admin", "meetings", "delete")).toBe(true);
    });

    it("returns false if role does not have permission for action", () => {
      expect(hasPermission("member", "meetings", "delete")).toBe(false);
      expect(hasPermission("guest", "organizations", "create")).toBe(false);
    });

    it("returns false for invalid inputs", () => {
      expect(hasPermission(null, "meetings", "view")).toBe(false);
      expect(hasPermission("admin", "unknown_resource", "view")).toBe(false);
      expect(hasPermission("admin", "meetings", "unknown_action")).toBe(false);
    });
  });

  describe("hasHigherOrEqualRole", () => {
    it("correctly compares roles based on hierarchy", () => {
      expect(hasHigherOrEqualRole("owner", "admin")).toBe(true);
      expect(hasHigherOrEqualRole("admin", "member")).toBe(true);
      expect(hasHigherOrEqualRole("guest", "moderator")).toBe(false);
      expect(hasHigherOrEqualRole("member", "member")).toBe(true);
      expect(hasHigherOrEqualRole("viewer", "guest")).toBe(true);
    });
  });

  describe("isValidRole", () => {
    it("returns true for valid roles", () => {
      expect(isValidRole("owner")).toBe(true);
      expect(isValidRole("member")).toBe(true);
      expect(isValidRole("viewer")).toBe(true);
    });

    it("returns false for invalid roles", () => {
      expect(isValidRole("superadmin")).toBe(false);
      expect(isValidRole("")).toBe(false);
    });
  });

  describe("client/server synchronization (#627)", () => {
    const server = loadServerPermissionExports();

    it("mirrors backend ROLE_HIERARCHY including viewer", () => {
      expect(ROLE_HIERARCHY).toEqual(server.ROLE_HIERARCHY);
    });

    it("mirrors backend PERMISSIONS map exactly", () => {
      expect(PERMISSIONS).toEqual(server.PERMISSIONS);
    });

    it("exposes previously missing backend permission actions", () => {
      expect(hasPermission("member", "settings", "self_view")).toBe(true);
      expect(hasPermission("guest", "settings", "self_edit")).toBe(true);
      expect(hasPermission("moderator", "knowledge", "consolidate")).toBe(true);
      expect(hasPermission("moderator", "knowledge", "resolve_conflicts")).toBe(
        true,
      );
      expect(hasPermission("moderator", "knowledge", "manage_lifecycle")).toBe(
        true,
      );
      expect(hasPermission("member", "notifications", "self_manage")).toBe(
        true,
      );
      expect(hasPermission("admin", "audit_logs", "view")).toBe(true);
      expect(hasPermission("member", "audit_logs", "view")).toBe(false);
      expect(hasPermission("admin", "automation_rules", "view")).toBe(true);
      expect(hasPermission("owner", "automation_rules", "create")).toBe(true);
      expect(hasPermission("member", "automation_rules", "view")).toBe(false);
      expect(hasPermission("moderator", "automation_rules", "edit")).toBe(
        false,
      );
    });

    it("rejects the previous invalid Automation Rules mapping (#1126)", () => {
      // resource was singular "organization" and action "manage" — neither exists
      expect(hasPermission("admin", "organization", "manage")).toBe(false);
      expect(hasPermission("owner", "organization", "manage")).toBe(false);
      expect(PERMISSIONS.organization).toBeUndefined();
      expect(PERMISSIONS.organizations.manage).toBeUndefined();
      expect(PERMISSIONS.automation_rules).toBeDefined();
    });

    it("allows viewer search/view but blocks meeting mutation", () => {
      expect(hasPermission("viewer", "meetings", "view")).toBe(true);
      expect(hasPermission("viewer", "ai_search", "search")).toBe(true);
      expect(hasPermission("viewer", "meetings", "create")).toBe(false);
      expect(hasPermission("member", "meetings", "create")).toBe(true);
      expect(hasPermission("moderator", "team_members", "invite")).toBe(false);
    });
  });
});
