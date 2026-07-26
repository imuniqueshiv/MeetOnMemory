import { describe, it, expect } from "vitest";
import {
  hasPermission,
  hasHigherOrEqualRole,
  isValidRole,
} from "../rbacPermissions";

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
    });
  });

  describe("isValidRole", () => {
    it("returns true for valid roles", () => {
      expect(isValidRole("owner")).toBe(true);
      expect(isValidRole("member")).toBe(true);
    });

    it("returns false for invalid roles", () => {
      expect(isValidRole("superadmin")).toBe(false);
      expect(isValidRole("")).toBe(false);
    });
  });
});
