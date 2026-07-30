import { describe, it, expect, beforeEach, vi } from "vitest";
import { ROLE_HIERARCHY, hasPermission } from "../utils/rbacPermissions.js";
import {
  inviteMemberToOrganization,
  acceptOrganizationInviteToken,
  updateMemberRole,
  removeMemberFromOrganization,
} from "../services/OrganizationService.js";
import Organization from "../models/organizationModel.js";
import Membership from "../models/membershipModel.js";
import Invitation from "../models/invitationModel.js";
import userModel from "../models/userModel.js";
import AuditService from "../services/AuditService.js";
import EmailService from "../services/EmailService.js";

vi.mock("../models/organizationModel.js");
vi.mock("../models/membershipModel.js");
vi.mock("../models/invitationModel.js");
vi.mock("../models/userModel.js");
vi.mock("../models/auditLogModel.js");
vi.mock("../services/AuditService.js");
vi.mock("../services/EmailService.js");

describe("Organization RBAC Overhaul, Admin Dashboard, and Audit Log (#496)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("4-Tier Roles & Permissions Matrix", () => {
    it("should include owner, admin, member, viewer in ROLE_HIERARCHY", () => {
      expect(ROLE_HIERARCHY).toHaveProperty("owner", 5);
      expect(ROLE_HIERARCHY).toHaveProperty("admin", 4);
      expect(ROLE_HIERARCHY).toHaveProperty("member", 2);
      expect(ROLE_HIERARCHY).toHaveProperty("viewer", 1);
    });

    it("should allow viewer to view meetings and search, but block mutation", () => {
      expect(hasPermission("viewer", "meetings", "view")).toBe(true);
      expect(hasPermission("viewer", "ai_search", "search")).toBe(true);
      expect(hasPermission("viewer", "meetings", "create")).toBe(false);
      expect(hasPermission("viewer", "meetings", "delete")).toBe(false);
      expect(hasPermission("viewer", "team_members", "invite")).toBe(false);
      expect(hasPermission("viewer", "team_members", "remove")).toBe(false);
    });

    it("should restrict role change and member removal to owner and admin", () => {
      expect(hasPermission("owner", "team_members", "change_role")).toBe(true);
      expect(hasPermission("admin", "team_members", "change_role")).toBe(true);
      expect(hasPermission("member", "team_members", "change_role")).toBe(
        false,
      );
      expect(hasPermission("viewer", "team_members", "change_role")).toBe(
        false,
      );
    });
  });

  describe("Invitation & Member Management Logic", () => {
    const actorId = "507f1f77bcf86cd799439011";
    const orgId = "507f1f77bcf86cd799439022";
    const targetUserId = "507f1f77bcf86cd799439033";

    it("should create invitation and send email when invited by owner/admin", async () => {
      vi.spyOn(Organization, "findById").mockResolvedValue({
        _id: orgId,
        name: "Test Corp",
        owner: actorId,
        members: [],
        save: vi.fn(),
      });
      vi.spyOn(Membership, "findOne").mockResolvedValue({
        user: actorId,
        organization: orgId,
        role: "owner",
        status: "active",
      });
      vi.spyOn(Invitation, "create").mockResolvedValue({
        _id: "inv123",
        token: "tok123",
        email: "test@example.com",
        role: "viewer",
      });
      vi.spyOn(userModel, "findOne").mockResolvedValue(null);
      vi.spyOn(userModel, "findById").mockResolvedValue({ name: "Admin User" });
      vi.spyOn(EmailService, "sendInvitation").mockResolvedValue(true);
      vi.spyOn(AuditService, "logAction").mockResolvedValue(true);

      const res = await inviteMemberToOrganization(actorId, orgId, {
        email: "test@example.com",
        role: "viewer",
        message: "Welcome!",
      });

      expect(res.success).toBe(true);
      expect(Invitation.create).toHaveBeenCalled();
      expect(AuditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ORGANIZATION_MEMBER_INVITED",
          actorId,
          organizationId: orgId,
        }),
      );
    });

    it("should allow accepting valid invite token", async () => {
      vi.spyOn(Invitation, "findOne").mockResolvedValue({
        _id: "inv123",
        token: "tok123",
        organization: orgId,
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 100000),
        save: vi.fn(),
      });
      vi.spyOn(Organization, "findById").mockResolvedValue({
        _id: orgId,
        name: "Test Corp",
        slug: "test-corp",
        members: [],
        save: vi.fn(),
      });
      vi.spyOn(Membership, "findOne").mockResolvedValue(null);
      vi.spyOn(Membership, "create").mockResolvedValue({
        user: targetUserId,
        organization: orgId,
        role: "member",
      });
      vi.spyOn(userModel, "findByIdAndUpdate").mockResolvedValue({});
      vi.spyOn(AuditService, "logAction").mockResolvedValue(true);

      const res = await acceptOrganizationInviteToken("tok123", targetUserId);

      expect(res.success).toBe(true);
      expect(Membership.create).toHaveBeenCalled();
      expect(AuditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ORGANIZATION_INVITE_ACCEPTED",
          actorId: targetUserId,
        }),
      );
    });

    it("should update member role and write audit log", async () => {
      vi.spyOn(Organization, "findById").mockResolvedValue({
        _id: orgId,
        owner: actorId,
        members: [{ userId: targetUserId, role: "member" }],
        save: vi.fn(),
      });
      vi.spyOn(Membership, "findOne").mockImplementation((query) => {
        if (query.user === actorId) {
          return Promise.resolve({ role: "owner", status: "active" });
        }
        return Promise.resolve({
          role: "member",
          status: "active",
          save: vi.fn(),
        });
      });
      vi.spyOn(userModel, "findById").mockResolvedValue({
        _id: targetUserId,
        organization: orgId,
        save: vi.fn(),
      });
      vi.spyOn(AuditService, "logAction").mockResolvedValue(true);

      const res = await updateMemberRole(
        actorId,
        orgId,
        targetUserId,
        "viewer",
      );

      expect(res.success).toBe(true);
      expect(AuditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "MEMBER_ROLE_CHANGED",
          actorId,
          entityId: targetUserId,
        }),
      );
    });

    it("should remove member from organization and write audit log", async () => {
      vi.spyOn(Organization, "findById").mockResolvedValue({
        _id: orgId,
        owner: actorId,
        members: [{ userId: targetUserId, role: "member" }],
        save: vi.fn(),
      });
      vi.spyOn(Membership, "findOne").mockResolvedValue({
        role: "owner",
        status: "active",
      });
      vi.spyOn(Membership, "findOneAndUpdate").mockResolvedValue({});
      vi.spyOn(userModel, "findById").mockResolvedValue(null);
      vi.spyOn(AuditService, "logAction").mockResolvedValue(true);

      const res = await removeMemberFromOrganization(
        actorId,
        orgId,
        targetUserId,
      );

      expect(res.success).toBe(true);
      expect(AuditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "MEMBER_REMOVED",
          actorId,
          entityId: targetUserId,
        }),
      );
    });
  });
});
