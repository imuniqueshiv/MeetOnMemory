import { describe, it, expect, beforeEach, vi } from "vitest";
import { hasPermission } from "../utils/rbacPermissions.js";
import { requirePermission } from "../middleware/rbac.js";

describe("Automation Rules RBAC mapping (#1126)", () => {
  let res;
  let next;

  beforeEach(() => {
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  it("grants owner and admin every automation_rules action", () => {
    for (const role of ["owner", "admin"]) {
      for (const action of ["view", "create", "edit", "delete"]) {
        expect(hasPermission(role, "automation_rules", action)).toBe(true);
      }
    }
  });

  it("denies non-admin roles automation_rules access", () => {
    for (const role of ["moderator", "member", "viewer", "guest"]) {
      expect(hasPermission(role, "automation_rules", "view")).toBe(false);
      expect(hasPermission(role, "automation_rules", "create")).toBe(false);
    }
  });

  it("rejects the previous invalid organization/manage mapping", () => {
    expect(hasPermission("admin", "organization", "manage")).toBe(false);
    expect(hasPermission("owner", "organizations", "manage")).toBe(false);
  });

  it("requirePermission allows an admin to view automation rules", () => {
    const middleware = requirePermission("automation_rules", "view");
    middleware({ user: { role: "admin", organization: "org1" } }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("requirePermission blocks a member from creating automation rules", () => {
    const middleware = requirePermission("automation_rules", "create");
    middleware({ user: { role: "member", organization: "org1" } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
