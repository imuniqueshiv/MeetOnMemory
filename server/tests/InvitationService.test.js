import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies before importing the service
vi.mock("../models/invitationModel.js", () => ({
  default: {
    create: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("../models/membershipModel.js", () => ({
  default: {
    create: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock("../models/organizationModel.js", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../models/userModel.js", () => ({
  default: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock("../services/EmailService.js", () => ({
  default: {
    sendInvitation: vi.fn().mockResolvedValue(true),
  },
}));

import * as InvitationService from "../services/InvitationService.js";
import Invitation from "../models/invitationModel.js";
import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";

describe("InvitationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── createInvitation ──────────────────────────────────────
  describe("createInvitation", () => {
    it("should throw ValidationError if organizationId or email is missing", async () => {
      await expect(
        InvitationService.createInvitation(
          "user1",
          { organizationId: null, email: null },
          { origin: "http://localhost", inviterName: "Admin" },
        ),
      ).rejects.toThrow("Organization ID and email are required.");
    });

    it("should throw ValidationError for invalid email", async () => {
      Organization.findById.mockResolvedValue({
        _id: "org1",
        owner: { toString: () => "user1" },
      });
      Membership.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ role: "admin" }),
      });

      await expect(
        InvitationService.createInvitation(
          "user1",
          { organizationId: "507f1f77bcf86cd799439011", email: "invalid" },
          { origin: "http://localhost", inviterName: "Admin" },
        ),
      ).rejects.toThrow("Invalid email address.");
    });

    it("should throw NotFoundError if organization does not exist", async () => {
      Organization.findById.mockResolvedValue(null);

      await expect(
        InvitationService.createInvitation(
          "user1",
          {
            organizationId: "507f1f77bcf86cd799439011",
            email: "test@example.com",
          },
          { origin: "http://localhost", inviterName: "Admin" },
        ),
      ).rejects.toThrow("Organization not found.");
    });

    it("should throw ForbiddenError if user is not admin/owner", async () => {
      Organization.findById.mockResolvedValue({
        _id: "org1",
        owner: { toString: () => "otherUser" },
      });
      Membership.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      await expect(
        InvitationService.createInvitation(
          "user1",
          {
            organizationId: "507f1f77bcf86cd799439011",
            email: "test@example.com",
          },
          { origin: "http://localhost", inviterName: "Admin" },
        ),
      ).rejects.toThrow("Not authorized to create invitations.");
    });

    it("should throw ValidationError if user is already a member", async () => {
      Organization.findById.mockResolvedValue({
        _id: "org1",
        owner: { toString: () => "admin1" },
      });
      Membership.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ role: "admin", status: "active" }),
      });
      userModel.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: "existingUser",
          email: "test@example.com",
        }),
      });

      // Second findOne for existing membership check
      // We need to handle the mock sequence carefully
      let membershipCallCount = 0;
      Membership.findOne.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue(
          membershipCallCount++ === 0
            ? { role: "admin", status: "active" } // admin check
            : { status: "active" }, // existing membership
        ),
      }));

      await expect(
        InvitationService.createInvitation(
          "admin1",
          {
            organizationId: "507f1f77bcf86cd799439011",
            email: "test@example.com",
          },
          { origin: "http://localhost", inviterName: "Admin" },
        ),
      ).rejects.toThrow("User is already a member of this organization.");
    });

    it("should throw ConflictError if pending invitation exists", async () => {
      Organization.findById.mockResolvedValue({
        _id: "org1",
        owner: { toString: () => "admin1" },
      });

      let membershipCallCount = 0;
      Membership.findOne.mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue(
          membershipCallCount++ === 0
            ? { role: "admin", status: "active" } // admin check
            : null, // no existing membership
        ),
      }));

      userModel.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null), // user doesn't exist yet
      });

      Invitation.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ status: "pending" }),
      });

      await expect(
        InvitationService.createInvitation(
          "admin1",
          {
            organizationId: "507f1f77bcf86cd799439011",
            email: "new@example.com",
          },
          { origin: "http://localhost", inviterName: "Admin" },
        ),
      ).rejects.toThrow("Pending invitation already exists for this email.");
    });

    it("should create invitation successfully", async () => {
      Organization.findById.mockResolvedValue({
        _id: "org1",
        name: "Test Org",
        owner: { toString: () => "admin1" },
      });

      let membershipCallCount = 0;
      Membership.findOne.mockImplementation(() => ({
        lean: vi
          .fn()
          .mockResolvedValue(
            membershipCallCount++ === 0
              ? { role: "admin", status: "active" }
              : null,
          ),
      }));

      userModel.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      Invitation.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const mockInvitation = {
        _id: "inv1",
        email: "new@example.com",
        status: "pending",
        token: "abc123",
      };
      Invitation.create.mockResolvedValue(mockInvitation);

      const result = await InvitationService.createInvitation(
        "admin1",
        {
          organizationId: "507f1f77bcf86cd799439011",
          email: "new@example.com",
          role: "member",
        },
        { origin: "http://localhost:5173", inviterName: "Admin" },
      );

      expect(result.success).toBe(true);
      expect(result.invitation).toEqual(mockInvitation);
      expect(Invitation.create).toHaveBeenCalled();
    });
  });

  // ── acceptInvitation ──────────────────────────────────────
  describe("acceptInvitation", () => {
    it("should throw NotFoundError if token is invalid", async () => {
      Invitation.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(null),
      });

      await expect(
        InvitationService.acceptInvitation("user1", "invalid-token"),
      ).rejects.toThrow("Invitation not found.");
    });

    it("should throw ValidationError if invitation is not pending", async () => {
      Invitation.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          status: "accepted",
          token: "tok1",
        }),
      });

      await expect(
        InvitationService.acceptInvitation("user1", "tok1"),
      ).rejects.toThrow("Invitation is not in pending status.");
    });

    it("should throw ValidationError if invitation has expired", async () => {
      const mockInvitation = {
        status: "pending",
        expiresAt: new Date(Date.now() - 1000), // expired
        save: vi.fn(),
      };
      Invitation.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockInvitation),
      });

      await expect(
        InvitationService.acceptInvitation("user1", "expired-tok"),
      ).rejects.toThrow("Invitation has expired.");

      expect(mockInvitation.status).toBe("expired");
      expect(mockInvitation.save).toHaveBeenCalled();
    });

    it("should throw ForbiddenError if email doesn't match", async () => {
      Invitation.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          status: "pending",
          expiresAt: new Date(Date.now() + 86400000),
          email: "someone@example.com",
          organization: { _id: "org1" },
        }),
      });

      userModel.findById.mockResolvedValue({
        email: "other@example.com",
      });

      await expect(
        InvitationService.acceptInvitation("user1", "tok1"),
      ).rejects.toThrow("Invitation is not for this user.");
    });

    it("should accept invitation and create membership", async () => {
      const mockInvitation = {
        status: "pending",
        expiresAt: new Date(Date.now() + 86400000),
        email: "invitee@example.com",
        role: "member",
        organization: { _id: "org1" },
        save: vi.fn(),
      };
      Invitation.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockInvitation),
      });

      userModel.findById.mockResolvedValue({
        email: "invitee@example.com",
      });

      Membership.findOne.mockResolvedValue(null);
      Membership.create.mockResolvedValue({
        user: "user1",
        organization: "org1",
        role: "member",
      });
      userModel.findByIdAndUpdate.mockResolvedValue(true);

      const result = await InvitationService.acceptInvitation(
        "user1",
        "valid-tok",
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Invitation accepted successfully.");
      expect(mockInvitation.status).toBe("accepted");
      expect(Membership.create).toHaveBeenCalled();
    });
  });

  // ── rejectInvitation ──────────────────────────────────────
  describe("rejectInvitation", () => {
    it("should decline the invitation", async () => {
      const mockInvitation = {
        status: "pending",
        email: "invitee@example.com",
        save: vi.fn(),
      };
      Invitation.findOne.mockResolvedValue(mockInvitation);

      userModel.findById.mockResolvedValue({
        email: "invitee@example.com",
      });

      const result = await InvitationService.rejectInvitation("user1", "tok1");

      expect(result.success).toBe(true);
      expect(mockInvitation.status).toBe("declined");
      expect(mockInvitation.save).toHaveBeenCalled();
    });
  });

  // ── revokeInvitation ──────────────────────────────────────
  describe("revokeInvitation", () => {
    it("should throw ForbiddenError if user is not admin", async () => {
      Invitation.findById.mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: "inv1",
          status: "pending",
          organization: {
            _id: "org1",
            owner: { toString: () => "ownerUser" },
          },
        }),
      });

      Membership.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      await expect(
        InvitationService.revokeInvitation(
          "randomUser",
          "507f1f77bcf86cd799439011",
        ),
      ).rejects.toThrow("Not authorized to revoke invitations.");
    });

    it("should cancel a pending invitation", async () => {
      const mockInvitation = {
        _id: "inv1",
        status: "pending",
        organization: {
          _id: "org1",
          owner: { toString: () => "admin1" },
        },
        save: vi.fn(),
      };
      Invitation.findById.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockInvitation),
      });

      Membership.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const result = await InvitationService.revokeInvitation(
        "admin1",
        "507f1f77bcf86cd799439011",
      );

      expect(result.success).toBe(true);
      expect(mockInvitation.status).toBe("cancelled");
    });
  });

  // ── getInvitationByToken ──────────────────────────────────
  describe("getInvitationByToken", () => {
    it("should throw NotFoundError for invalid token", async () => {
      Invitation.findOne.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        InvitationService.getInvitationByToken("bad-token"),
      ).rejects.toThrow("Invitation not found.");
    });

    it("should return invitation for valid token", async () => {
      const mockInvitation = {
        token: "valid-tok",
        status: "pending",
        expiresAt: new Date(Date.now() + 86400000),
        organization: { name: "Org" },
      };
      Invitation.findOne.mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockResolvedValue(mockInvitation),
        }),
      });

      const result = await InvitationService.getInvitationByToken("valid-tok");

      expect(result.success).toBe(true);
      expect(result.invitation).toEqual(mockInvitation);
    });
  });
});
