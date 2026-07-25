import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies before importing the service
vi.mock("../models/organizationModel.js", () => ({
  default: {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock("../models/userModel.js", () => ({
  default: {
    findByIdAndUpdate: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("../models/membershipModel.js", () => ({
  default: {
    create: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    deleteMany: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock("../models/membershipRequestModel.js", () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock("../services/AuditService.js", () => ({
  default: {
    logAction: vi.fn(),
  },
}));

vi.mock("../services/eventBus.js", () => ({
  default: {
    emit: vi.fn(),
  },
}));

import * as OrganizationService from "../services/OrganizationService.js";
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import Membership from "../models/membershipModel.js";
import MembershipRequest from "../models/membershipRequestModel.js";
import AuditService from "../services/AuditService.js";

describe("OrganizationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── createOrJoinOrganization ──────────────────────────────
  describe("createOrJoinOrganization", () => {
    it("should create a new org when none exists", async () => {
      Organization.findOne.mockResolvedValue(null);

      const mockOrg = {
        _id: "org123",
        name: "Acme",
        slug: "acme-abc123",
        members: ["user1"],
        createdBy: "user1",
      };
      Organization.create.mockResolvedValue(mockOrg);

      userModel.findByIdAndUpdate.mockResolvedValue(true);
      userModel.findById.mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: "user1",
          role: "admin",
          organization: { _doc: { _id: "org123", name: "Acme" }, name: "Acme" },
          _doc: { name: "User 1" },
        }),
      });

      const result = await OrganizationService.createOrJoinOrganization(
        "user1",
        "Acme",
        null,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Organization created successfully!");
      expect(Organization.create).toHaveBeenCalled();
      expect(AuditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: "ORGANIZATION_CREATED" }),
      );
    });

    it("should join existing org when it exists", async () => {
      const mockOrg = {
        _id: "org123",
        name: "Acme",
        visibility: "public",
        members: ["existingUser"],
        createdBy: "existingUser",
        save: vi.fn(),
      };
      mockOrg.members.some = Array.prototype.some.bind(mockOrg.members);
      Organization.findOne.mockResolvedValue(mockOrg);
      Membership.findOne.mockResolvedValue(null);
      MembershipRequest.findOne.mockResolvedValue(null);
      Membership.create.mockResolvedValue({});

      userModel.findByIdAndUpdate.mockResolvedValue(true);
      userModel.findById.mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: "newUser",
          role: "member",
          organization: { _doc: { _id: "org123", name: "Acme" }, name: "Acme" },
          _doc: { name: "New User" },
        }),
      });

      const result = await OrganizationService.createOrJoinOrganization(
        "newUser",
        "Acme",
        null,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Joined existing organization successfully.");
      expect(Organization.create).not.toHaveBeenCalled();
      expect(Membership.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: "member", status: "active" }),
      );
    });
  });

  // ── getAllOrganizations ────────────────────────────────────
  describe("getAllOrganizations", () => {
    it("should return all organizations sorted by createdAt", async () => {
      const mockOrgs = [
        { _id: "org1", name: "Org A" },
        { _id: "org2", name: "Org B" },
      ];
      Organization.find.mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockOrgs),
      });

      const result = await OrganizationService.getAllOrganizations();

      expect(result.success).toBe(true);
      expect(result.organizations).toHaveLength(2);
    });
  });

  // ── joinOrganizationById ──────────────────────────────────
  describe("joinOrganizationById", () => {
    it("should throw ValidationError if organizationId is missing", async () => {
      await expect(
        OrganizationService.joinOrganizationById("user1", null, null),
      ).rejects.toThrow("organizationId is required.");
    });

    it("should throw NotFoundError if org does not exist", async () => {
      Organization.findById.mockResolvedValue(null);

      await expect(
        OrganizationService.joinOrganizationById(
          "user1",
          "507f1f77bcf86cd799439011",
          null,
        ),
      ).rejects.toThrow("Organization not found.");
    });

    it("allows direct joining of a public organization", async () => {
      const organization = {
        _id: "507f1f77bcf86cd799439011",
        visibility: "public",
        joinPolicy: "open",
        members: [],
        save: vi.fn(),
      };
      Organization.findById.mockResolvedValue(organization);
      Membership.findOne.mockResolvedValue(null);
      MembershipRequest.findOne.mockResolvedValue(null);
      Membership.create.mockResolvedValue({});
      userModel.findByIdAndUpdate.mockResolvedValue({});
      userModel.findById.mockReturnValue({
        populate: vi.fn().mockResolvedValue({ _id: "user1" }),
      });

      await expect(
        OrganizationService.joinOrganizationById(
          "user1",
          "507f1f77bcf86cd799439011",
        ),
      ).resolves.toEqual(expect.objectContaining({ success: true }));
    });

    it("rejects direct joining of a private organization", async () => {
      Organization.findById.mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        visibility: "private",
        members: [],
      });

      const joinAttempt = OrganizationService.joinOrganizationById(
        "user1",
        "507f1f77bcf86cd799439011",
      );

      await expect(joinAttempt).rejects.toMatchObject({ statusCode: 403 });
      await expect(joinAttempt).rejects.toThrow(
        "requires invitation or membership approval",
      );
      expect(Membership.create).not.toHaveBeenCalled();
    });

    it("keeps an existing member linked when the organization is private", async () => {
      const organization = {
        _id: "507f1f77bcf86cd799439011",
        visibility: "private",
        members: [],
      };
      Organization.findById.mockResolvedValue(organization);
      Membership.findOne.mockResolvedValue({ role: "member" });
      MembershipRequest.findOne.mockResolvedValue(null);
      userModel.findByIdAndUpdate.mockResolvedValue({});
      userModel.findById.mockReturnValue({
        populate: vi.fn().mockResolvedValue({ _id: "user1" }),
      });

      await expect(
        OrganizationService.joinOrganizationById(
          "user1",
          "507f1f77bcf86cd799439011",
        ),
      ).resolves.toEqual(expect.objectContaining({ success: true }));
      expect(Membership.create).not.toHaveBeenCalled();
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({ organization: organization._id }),
      );
    });

    it("rejects direct joining of an invite-only organization", async () => {
      Organization.findById.mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        visibility: "invite-only",
        members: [],
      });

      await expect(
        OrganizationService.joinOrganizationById(
          "user1",
          "507f1f77bcf86cd799439011",
        ),
      ).rejects.toThrow("requires a valid invitation");
      expect(Membership.create).not.toHaveBeenCalled();
    });

    it("does not bypass a pending membership request", async () => {
      Organization.findById.mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        visibility: "public",
        members: [],
      });
      Membership.findOne.mockResolvedValue(null);
      MembershipRequest.findOne.mockResolvedValue({ _id: "request1" });

      await expect(
        OrganizationService.joinOrganizationById(
          "user1",
          "507f1f77bcf86cd799439011",
        ),
      ).rejects.toThrow("already pending");
      expect(Membership.create).not.toHaveBeenCalled();
    });
  });

  // ── createOrganization ────────────────────────────────────
  describe("createOrganization", () => {
    it("should throw ConflictError when org name already exists", async () => {
      Organization.findOne.mockResolvedValue({ _id: "existing", name: "Dupe" });

      await expect(
        OrganizationService.createOrganization("user1", { name: "Dupe" }),
      ).rejects.toThrow("Organization with this name already exists.");
    });

    it("should create org and membership on success", async () => {
      Organization.findOne.mockResolvedValue(null);

      const mockOrg = {
        _id: "newOrg",
        name: "NewCo",
        slug: "newco-abc123",
      };
      Organization.create.mockResolvedValue(mockOrg);
      Membership.create.mockResolvedValue({});
      userModel.findByIdAndUpdate.mockResolvedValue(true);

      const result = await OrganizationService.createOrganization("user1", {
        name: "NewCo",
      });

      expect(result.success).toBe(true);
      expect(result.organization).toEqual(mockOrg);
      expect(Membership.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: "admin", status: "active" }),
      );
    });
  });

  // ── deleteOrganization ────────────────────────────────────
  describe("deleteOrganization", () => {
    it("should throw ForbiddenError if user is not the owner", async () => {
      Organization.findById.mockResolvedValue({
        _id: "org1",
        owner: { toString: () => "ownerUser" },
      });

      await expect(
        OrganizationService.deleteOrganization(
          "otherUser",
          "507f1f77bcf86cd799439011",
        ),
      ).rejects.toThrow("Not authorized to delete this organization.");
    });

    it("should delete org and memberships on success", async () => {
      Organization.findById.mockResolvedValue({
        _id: "org1",
        owner: { toString: () => "ownerUser" },
      });
      Membership.deleteMany.mockResolvedValue({});
      Organization.findByIdAndDelete.mockResolvedValue({});

      const result = await OrganizationService.deleteOrganization(
        "ownerUser",
        "507f1f77bcf86cd799439011",
      );

      expect(result.success).toBe(true);
      expect(Membership.deleteMany).toHaveBeenCalled();
      expect(Organization.findByIdAndDelete).toHaveBeenCalled();
    });
  });

  // ── updateOrganization ────────────────────────────────────
  describe("updateOrganization", () => {
    it("should throw ForbiddenError if user is not admin/owner", async () => {
      Organization.findById.mockResolvedValue({
        _id: "org1",
        owner: { toString: () => "ownerUser" },
      });
      Membership.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      await expect(
        OrganizationService.updateOrganization(
          "otherUser",
          "507f1f77bcf86cd799439011",
          { name: "Updated" },
        ),
      ).rejects.toThrow("Not authorized to update this organization.");
    });

    it("should update and save when authorized", async () => {
      const mockOrg = {
        _id: "org1",
        name: "Old Name",
        owner: { toString: () => "ownerUser" },
        save: vi.fn().mockResolvedValue(true),
      };
      Organization.findById.mockResolvedValue(mockOrg);
      Membership.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const result = await OrganizationService.updateOrganization(
        "ownerUser",
        "507f1f77bcf86cd799439011",
        { name: "New Name" },
      );

      expect(result.success).toBe(true);
      expect(mockOrg.name).toBe("New Name");
      expect(mockOrg.save).toHaveBeenCalled();
    });
  });

  // ── browsePublicOrganizations ──────────────────────────────
  describe("browsePublicOrganizations", () => {
    it("should return public organizations with correct pagination and counts", async () => {
      const mockOrgs = [
        {
          _id: "org1",
          name: "Public Org A",
          slug: "public-org-a",
          visibility: "public",
          members: ["user1", "user2"],
        },
      ];
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockOrgs),
      };
      Organization.find.mockReturnValue(mockQueryChain);
      Organization.countDocuments.mockResolvedValue(1);

      const result = await OrganizationService.browsePublicOrganizations({
        page: 1,
        limit: 12,
        search: "",
        sortBy: "createdAt",
        filter: "all",
      });

      expect(result.success).toBe(true);
      expect(result.organizations).toHaveLength(1);
      expect(result.organizations[0].memberCount).toBe(2);
      expect(result.pagination.total).toBe(1);
      expect(Organization.find).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: "public" }),
      );
    });
  });

  // ── searchOrganizations ─────────────────────────────────────
  describe("searchOrganizations", () => {
    it("should search public organizations matching query q", async () => {
      const mockOrgs = [
        {
          _id: "org2",
          name: "Searched Public Org",
          slug: "search-org",
          visibility: "public",
          members: [],
        },
      ];
      const mockQueryChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockOrgs),
      };
      Organization.find.mockReturnValue(mockQueryChain);
      Organization.countDocuments.mockResolvedValue(1);

      const result = await OrganizationService.searchOrganizations(
        "Search",
        1,
        12,
      );

      expect(result.success).toBe(true);
      expect(result.organizations).toHaveLength(1);
      expect(result.organizations[0].name).toBe("Searched Public Org");
      expect(Organization.find).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: "public",
          $or: expect.any(Array),
        }),
      );
    });
  });
});
