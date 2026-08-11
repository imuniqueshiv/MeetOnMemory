import { describe, it, expect, beforeEach, vi } from "vitest";
import { requirePermission } from "../middleware/rbac.js";

describe("Session Generation AI Permission Enforcement (#836)", () => {
  let req, res, next;

  beforeEach(() => {
    next = vi.fn();
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it("permits users with AI search privileges (e.g. member, admin, owner)", () => {
    req = { user: { role: "member" } };
    const middleware = requirePermission("ai_search", "search");
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("denies requests from unassigned or unauthorized roles without AI permissions", () => {
    req = { user: { role: "unauthorized_role" } };
    const middleware = requirePermission("ai_search", "search");
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining("Forbidden"),
      }),
    );
  });

  it("denies unauthenticated requests", () => {
    req = {};
    const middleware = requirePermission("ai_search", "search");
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Unauthorized",
    });
  });
});
