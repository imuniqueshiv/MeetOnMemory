/**
 * Issue #2664 — Add permission gate to membership request comment endpoint
 *
 * Tests:
 * 1. Unauthenticated caller -> rejected (401)
 * 2. Authenticated user without required team_members permission -> rejected (403)
 * 3. Authenticated user with permission but from WRONG organization -> rejected (403)
 * 4. Authenticated user with correct permission AND correct organization -> allowed (201)
 * 5. Valid request/comment behavior remains successful for authorized caller.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import mongoose from "mongoose";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js";
import MembershipRequestService from "../services/MembershipRequestService.js";
import MembershipRequest from "../models/membershipRequestModel.js";
import Membership from "../models/membershipModel.js";
import { addCommentToMembershipRequest } from "../controllers/membershipRequestController.js";

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();
const USER_ID = new mongoose.Types.ObjectId();

const makeRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status: vi.fn(function (code) {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn(function (body) {
      res.body = body;
      return res;
    }),
  };
  return res;
};

describe("Membership Request Comment Endpoint Authorization (#2664)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Middleware Gate Checks", () => {
    it("1. Unauthenticated caller is rejected with 401 by requireOrgMembership and requirePermission", () => {
      const req = { user: null };
      const res = makeRes();
      const next = vi.fn();

      requireOrgMembership(req, res, next);
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(next).not.toHaveBeenCalled();

      const resPerm = makeRes();
      const nextPerm = vi.fn();
      requirePermission("team_members", "view")(req, resPerm, nextPerm);
      expect(resPerm.statusCode).toBe(401);
      expect(resPerm.body.success).toBe(false);
      expect(nextPerm).not.toHaveBeenCalled();
    });

    it("2. Authenticated user without role is rejected with 403 by requirePermission", () => {
      const req = { user: { _id: USER_ID, organization: ORG_A } };
      const res = makeRes();
      const next = vi.fn();

      requirePermission("team_members", "view")(req, res, next);
      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("No role assigned");
      expect(next).not.toHaveBeenCalled();
    });

    it("2b. Authenticated user missing required team_members permission is rejected with 403", () => {
      const req = {
        user: { _id: USER_ID, organization: ORG_A, role: "invalid_role" },
      };
      const res = makeRes();
      const next = vi.fn();

      requirePermission("team_members", "view")(req, res, next);
      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("You don't have permission");
      expect(next).not.toHaveBeenCalled();
    });

    it("Passes middleware when user has organization and valid team_members:view role", () => {
      const req = {
        user: { _id: USER_ID, organization: ORG_A, role: "member" },
      };
      const resOrg = makeRes();
      const nextOrg = vi.fn();
      requireOrgMembership(req, resOrg, nextOrg);
      expect(nextOrg).toHaveBeenCalled();

      const resPerm = makeRes();
      const nextPerm = vi.fn();
      requirePermission("team_members", "view")(req, resPerm, nextPerm);
      expect(nextPerm).toHaveBeenCalled();
    });
  });

  describe("Organization Boundary Enforcement", () => {
    it("3. Rejects comment when user organization differs from membership request organization", async () => {
      const requestId = new mongoose.Types.ObjectId();
      const mockReqDoc = {
        _id: requestId,
        user: new mongoose.Types.ObjectId(),
        organization: { _id: ORG_B, owner: new mongoose.Types.ObjectId() },
        comments: [],
      };

      vi.spyOn(MembershipRequest, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockReqDoc),
      });

      await expect(
        MembershipRequestService.addComment(
          USER_ID.toString(),
          requestId.toString(),
          "Hello cross org",
          ORG_A.toString(), // User belongs to ORG_A, request belongs to ORG_B
        ),
      ).rejects.toThrow("Not authorized to comment on this request.");
    });

    it("4. Allows comment when user organization matches membership request organization and user has access", async () => {
      const requestId = new mongoose.Types.ObjectId();
      const mockReqDoc = {
        _id: requestId,
        user: USER_ID,
        organization: { _id: ORG_A, owner: USER_ID },
        comments: [],
        save: vi.fn().mockResolvedValue(true),
        populate: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(MembershipRequest, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockReqDoc),
      });
      vi.spyOn(Membership, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const res = await MembershipRequestService.addComment(
        USER_ID.toString(),
        requestId.toString(),
        "Valid comment same org",
        ORG_A.toString(), // User belongs to ORG_A, request belongs to ORG_A
      );

      expect(mockReqDoc.comments.length).toBe(1);
      expect(mockReqDoc.comments[0].text).toBe("Valid comment same org");
      expect(res).toBe(mockReqDoc);
    });
  });

  describe("Controller Flow & Response Shape Preservation", () => {
    it("5. addCommentToMembershipRequest controller returns 201 with created comment for authorized caller", async () => {
      const requestId = new mongoose.Types.ObjectId().toString();
      const mockRequest = {
        _id: requestId,
        comments: [{ text: "Test comment" }],
      };

      vi.spyOn(MembershipRequestService, "addComment").mockResolvedValue(
        mockRequest,
      );

      const req = {
        params: { id: requestId },
        body: { text: "Test comment" },
        user: { id: USER_ID.toString(), organization: ORG_A.toString() },
      };
      const res = makeRes();
      const next = vi.fn();

      await addCommentToMembershipRequest(req, res, next);

      expect(MembershipRequestService.addComment).toHaveBeenCalledWith(
        USER_ID.toString(),
        requestId,
        "Test comment",
        ORG_A.toString(),
      );
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.request).toEqual(mockRequest);
      expect(res.body.message).toBe("Comment added successfully.");
    });
  });
});
