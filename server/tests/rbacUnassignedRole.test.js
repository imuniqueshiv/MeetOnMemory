import { jest } from "@jest/globals";
import {
  requireAdminOrOwner,
  requireAnyPermission,
  requireMinimumRole,
  requirePermission,
  requireRole,
} from "../middleware/rbac.js";

/**
 * Regression for Issue #1116:
 * Users without an assigned role must not inherit guest-level permissions.
 * Null/missing roles are denied as unauthorized until onboarding or role
 * assignment completes, while the literal "guest" role keeps its behaviour.
 */
describe("RBAC unassigned-role enforcement (#1116)", () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  describe("requireRole", () => {
    it("denies a user with no role assigned", () => {
      const middleware = requireRole(["admin", "owner"]);
      const res = mockRes();
      const next = jest.fn();

      middleware({ user: { role: null } }, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Forbidden: No role assigned",
        }),
      );
    });

    it("still permits an allowed assigned role", () => {
      const middleware = requireRole(["admin", "owner"]);
      const res = mockRes();
      const next = jest.fn();

      middleware({ user: { role: "admin" } }, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("still denies a role outside the allowed set", () => {
      const middleware = requireRole(["admin", "owner"]);
      const res = mockRes();
      const next = jest.fn();

      middleware({ user: { role: "member" } }, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Forbidden: Insufficient role",
        }),
      );
    });
  });

  describe("requirePermission", () => {
    it("denies a user with no role assigned", () => {
      const middleware = requirePermission("meetings", "view");
      const res = mockRes();
      const next = jest.fn();

      middleware({ user: { role: null } }, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Forbidden: No role assigned",
        }),
      );
    });

    it("denies a user whose role property is missing entirely", () => {
      const middleware = requirePermission("meetings", "view");
      const res = mockRes();
      const next = jest.fn();

      middleware({ user: {} }, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("still permits an assigned guest role on guest-permitted actions", () => {
      const middleware = requirePermission("meetings", "view");
      const res = mockRes();
      const next = jest.fn();

      middleware({ user: { role: "guest" } }, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("still denies an assigned guest role on non-guest actions", () => {
      const middleware = requirePermission("meetings", "edit");
      const res = mockRes();
      const next = jest.fn();

      middleware({ user: { role: "guest" } }, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("still permits assigned member roles", () => {
      const middleware = requirePermission("ai_search", "search");
      const res = mockRes();
      const next = jest.fn();

      middleware({ user: { role: "member" } }, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("requireAnyPermission", () => {
    it("denies a user with no role assigned", () => {
      const middleware = requireAnyPermission("meetings", ["view", "edit"]);
      const res = mockRes();
      const next = jest.fn();

      middleware({ user: { role: null } }, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Forbidden: No role assigned",
        }),
      );
    });

    it("still permits an assigned guest role on guest-permitted actions", () => {
      const middleware = requireAnyPermission("meetings", ["view", "edit"]);
      const res = mockRes();
      const next = jest.fn();

      middleware({ user: { role: "guest" } }, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("non-regression for other RBAC middleware", () => {
    it("requireMinimumRole still denies a user with no role", () => {
      const middleware = requireMinimumRole("viewer");
      const res = mockRes();
      const next = jest.fn();

      middleware({ user: { role: null } }, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("requireMinimumRole still permits an assigned role at/above the minimum", () => {
      const middleware = requireMinimumRole("viewer");
      const res = mockRes();
      const next = jest.fn();

      middleware({ user: { role: "member" } }, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("requireAdminOrOwner still denies a user with no role", () => {
      const res = mockRes();
      const next = jest.fn();

      requireAdminOrOwner({ user: { role: null } }, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("requireAdminOrOwner still permits an owner", () => {
      const res = mockRes();
      const next = jest.fn();

      requireAdminOrOwner({ user: { role: "owner" } }, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
