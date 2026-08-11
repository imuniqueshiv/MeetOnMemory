import { describe, it, expect, vi, beforeEach } from "vitest";
import * as OrganizationService from "../services/OrganizationService.js";
import Organization from "../models/organizationModel.js";
import Membership from "../models/membershipModel.js";
import MembershipRequest from "../models/membershipRequestModel.js";

vi.mock("../models/organizationModel.js", () => ({
  default: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock("../models/membershipModel.js", () => ({
  default: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock("../models/membershipRequestModel.js", () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock("../models/userModel.js", () => ({
  default: {
    findByIdAndUpdate: vi.fn(),
    findById: vi.fn().mockReturnValue({
      populate: vi.fn().mockResolvedValue({
        _id: "user1",
        role: "admin",
        organization: { _doc: { name: "Clerk Testing" } },
      }),
    }),
  },
}));

vi.mock("../services/AuditService.js", () => ({
  default: {
    logAction: vi.fn(),
  },
}));

describe("Public Organization Discovery & Search (#1095)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets visibility to public by default in createOrJoinOrganization", async () => {
    Organization.findOne.mockResolvedValue(null);
    Organization.create.mockResolvedValue({
      _id: "org1095",
      name: "Clerk Testing",
      slug: "clerk-testing-12345",
      owner: "accountA",
      createdBy: "accountA",
      visibility: "public",
    });
    Membership.create.mockResolvedValue({});

    const result = await OrganizationService.createOrJoinOrganization(
      "accountA",
      "Clerk Testing",
    );

    expect(Organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Clerk Testing",
        visibility: "public",
        owner: "accountA",
      }),
    );
    expect(result.success).toBe(true);
  });

  it("allows Account B to discover public organizations created by Account A", async () => {
    const mockOrgs = [
      {
        _id: "org1",
        name: "Clerk Testing",
        slug: "clerk-testing",
        description: "Testing org for Clerk",
        visibility: "public",
        createdAt: new Date(),
        members: [{ userId: "accountA", role: "admin" }],
      },
    ];

    const findChain = {
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockOrgs),
    };

    Organization.find.mockReturnValue(findChain);
    Organization.countDocuments.mockResolvedValue(1);
    Membership.aggregate.mockResolvedValue([{ _id: "org1", count: 1 }]);
    Membership.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });
    MembershipRequest.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await OrganizationService.browsePublicOrganizations({
      userId: "accountB",
      search: "Clerk",
      sortBy: "createdAt",
      filter: "all",
    });

    expect(result.success).toBe(true);
    expect(result.organizations).toHaveLength(1);
    expect(result.organizations[0].name).toBe("Clerk Testing");
    expect(result.organizations[0].membershipStatus).toBe("none");
  });

  it("calculates pending status for users with an active membership request", async () => {
    const mockOrgs = [
      {
        _id: "org2",
        name: "Dev Community",
        slug: "dev-community",
        visibility: "public",
        createdAt: new Date(),
      },
    ];

    const findChain = {
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockOrgs),
    };

    Organization.find.mockReturnValue(findChain);
    Organization.countDocuments.mockResolvedValue(1);
    Membership.aggregate.mockResolvedValue([{ _id: "org2", count: 3 }]);
    Membership.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });
    MembershipRequest.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi
          .fn()
          .mockResolvedValue([{ organization: "org2", status: "pending" }]),
      }),
    });

    const result = await OrganizationService.browsePublicOrganizations({
      userId: "accountB",
      search: "",
    });

    expect(result.organizations[0].membershipStatus).toBe("pending");
  });
});
