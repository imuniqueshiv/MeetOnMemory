import { jest } from "@jest/globals";

const mockOrgFindOne = jest.fn();
const mockOrgFindById = jest.fn();
const mockOrgCreate = jest.fn();
const mockUserFindById = jest.fn();
const mockUserFindByIdAndUpdate = jest.fn();
const mockMembershipCreate = jest.fn();
const mockMembershipFindOneAndUpdate = jest.fn();
const mockMembershipFindOne = jest.fn();
const mockInvitationFindOne = jest.fn();
const mockMembershipRequestFindOne = jest.fn();

jest.unstable_mockModule("../models/organizationModel.js", () => ({
  default: {
    findOne: mockOrgFindOne,
    findById: mockOrgFindById,
    create: mockOrgCreate,
  },
}));

jest.unstable_mockModule("../models/userModel.js", () => ({
  default: {
    findById: mockUserFindById,
    findByIdAndUpdate: mockUserFindByIdAndUpdate,
  },
}));

jest.unstable_mockModule("../models/membershipModel.js", () => ({
  default: {
    create: mockMembershipCreate,
    findOneAndUpdate: mockMembershipFindOneAndUpdate,
    findOne: mockMembershipFindOne,
  },
}));

jest.unstable_mockModule("../models/invitationModel.js", () => ({
  default: {
    findOne: mockInvitationFindOne,
  },
}));

jest.unstable_mockModule("../models/membershipRequestModel.js", () => ({
  default: {
    findOne: mockMembershipRequestFindOne,
  },
}));

jest.unstable_mockModule("../services/AuditService.js", () => ({
  default: {
    logAction: jest.fn(),
  },
}));

jest.unstable_mockModule("../services/notificationService.js", () => ({
  createAndPushNotification: jest.fn(),
}));

const { createOrJoinOrganization, joinOrganization } = await import(
  "../controllers/organizationController.js"
);

const makeUserMockQuery = (userData) => {
  const query = {
    populate: jest.fn().mockReturnThis(),
    then: (resolve) => resolve(userData),
  };
  return query;
};

describe("Organization Join Security & Authorization Checks (#384)", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrgFindOne.mockReset();
    mockOrgFindById.mockReset();
    mockOrgCreate.mockReset();
    mockUserFindById.mockReset();
    mockUserFindByIdAndUpdate.mockReset();
    mockMembershipCreate.mockReset();
    mockMembershipFindOneAndUpdate.mockReset();
    mockMembershipFindOne.mockReset();
    mockInvitationFindOne.mockReset();
    mockMembershipRequestFindOne.mockReset();

    mockMembershipFindOne.mockResolvedValue(null);
    mockMembershipRequestFindOne.mockResolvedValue(null);

    req = {
      user: { id: "user_123" },
      body: {},
      app: {
        get: jest.fn().mockReturnValue(null),
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("Unauthenticated User", () => {
    it("should return 401 for unauthenticated user in createOrJoinOrganization", async () => {
      req.user = null;
      req.body = { name: "Public Org" };

      await createOrJoinOrganization(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Authentication failed.",
      });
    });

    it("should return 401 for unauthenticated user in joinOrganization", async () => {
      req.user = null;
      req.body = { organizationId: "507f1f77bcf86cd799439011" };

      await joinOrganization(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("Public Organizations", () => {
    it("should allow joining a public organization directly", async () => {
      req.body = { name: "Open Source Community" };

      const mockPublicOrg = {
        _id: "org_pub_1",
        name: "Open Source Community",
        visibility: "public",
        members: ["existing_user"],
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrgFindOne.mockResolvedValue(mockPublicOrg);
      mockUserFindByIdAndUpdate.mockResolvedValue(true);
      
      const userData = {
        _id: "user_123",
        role: "member",
        organization: mockPublicOrg,
        _doc: { name: "User 123" },
      };
      mockUserFindById.mockReturnValue(makeUserMockQuery(userData));

      await createOrJoinOrganization(req, res);

      expect(mockPublicOrg.members).toContain("user_123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Joined existing organization successfully.",
        }),
      );
    });
  });

  describe("Private & Invite-Only Organizations Without Invitation", () => {
    it("should return 403 Forbidden when attempting to join private org without an invitation", async () => {
      req.body = { name: "Secret Org" };

      const mockPrivateOrg = {
        _id: "org_priv_1",
        name: "Secret Org",
        visibility: "private",
        members: ["owner_id"],
      };

      mockOrgFindOne.mockResolvedValue(mockPrivateOrg);
      
      const userData = {
        _id: "user_123",
        email: "user@example.com",
      };
      mockUserFindById.mockReturnValue(makeUserMockQuery(userData));
      mockInvitationFindOne.mockResolvedValue(null);
      mockMembershipRequestFindOne.mockResolvedValue(null);

      await createOrJoinOrganization(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message:
          "This private organization requires invitation or membership approval.",
      });
    });

    it("should return 403 Forbidden when attempting to join invite-only org via joinOrganization by ID", async () => {
      const orgId = "507f1f77bcf86cd799439011";
      req.body = { organizationId: orgId };

      const mockInviteOnlyOrg = {
        _id: orgId,
        name: "Restricted Org",
        visibility: "invite-only",
        members: ["admin_user"],
      };

      mockOrgFindById.mockResolvedValue(mockInviteOnlyOrg);
      
      const userData = {
        _id: "user_123",
        email: "user@example.com",
      };
      mockUserFindById.mockReturnValue(makeUserMockQuery(userData));
      mockInvitationFindOne.mockResolvedValue(null);
      mockMembershipRequestFindOne.mockResolvedValue(null);

      await joinOrganization(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message:
          "This organization requires a valid invitation to join.",
      });
    });
  });

  describe("Private / Invite-Only Organizations WITH Valid Invitation", () => {
    it("should allow joining private org when user has a valid pending invitation", async () => {
      req.body = { name: "Private Org", invitationToken: "valid_token_123" };

      const mockPrivateOrg = {
        _id: "org_priv_2",
        name: "Private Org",
        visibility: "private",
        members: ["owner_id"],
        save: jest.fn().mockResolvedValue(true),
      };

      const mockInvitation = {
        _id: "inv_1",
        status: "pending",
        save: jest.fn().mockResolvedValue(true),
      };

      mockOrgFindOne.mockResolvedValue(mockPrivateOrg);
      
      const userData = {
        _id: "user_123",
        email: "user@example.com",
        role: "member",
        organization: mockPrivateOrg,
        _doc: { name: "User 123" },
      };
      mockUserFindById.mockReturnValue(makeUserMockQuery(userData));
      mockInvitationFindOne.mockResolvedValue(mockInvitation);
      mockUserFindByIdAndUpdate.mockResolvedValue(true);

      await createOrJoinOrganization(req, res);

      expect(mockInvitation.status).toBe("accepted");
      expect(mockInvitation.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Joined existing organization successfully.",
        }),
      );
    });
  });

  describe("Pending Membership Request Check", () => {
    it("should return 409 Conflict if membership request is already pending approval", async () => {
      req.body = { name: "Approval Required Org" };

      const mockPrivateOrg = {
        _id: "org_priv_3",
        name: "Approval Required Org",
        visibility: "private",
        members: ["owner_id"],
      };

      mockOrgFindOne.mockResolvedValue(mockPrivateOrg);
      
      const userData = {
        _id: "user_123",
        email: "user@example.com",
      };
      mockUserFindById.mockReturnValue(makeUserMockQuery(userData));
      mockInvitationFindOne.mockResolvedValue(null);
      mockMembershipRequestFindOne.mockResolvedValue({
        _id: "req_1",
        status: "pending",
      });

      await createOrJoinOrganization(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "A membership request for this organization is already pending.",
      });
    });
  });

  describe("Duplicate Membership Prevention", () => {
    it("should return 400 Bad Request if user is already a member of the organization", async () => {
      req.body = { name: "Existing Org" };

      const mockOrg = {
        _id: "org_exist_1",
        name: "Existing Org",
        visibility: "public",
        members: ["user_123"],
      };

      mockOrgFindOne.mockResolvedValue(mockOrg);
      mockMembershipFindOne.mockResolvedValue({ role: "member" });

      await createOrJoinOrganization(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "You are already a member of this organization.",
      });
    });
  });
});
