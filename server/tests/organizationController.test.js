import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createOrJoinOrganization,
  getOrganizationSettings,
  updateOrganization,
} from "../controllers/organizationController.js";
import * as OrganizationService from "../services/OrganizationService.js";

// Mock the service layer
vi.mock("../services/OrganizationService.js", () => ({
  createOrJoinOrganization: vi.fn(),
  getOrganizationSettings: vi.fn(),
  updateOrganization: vi.fn(),
}));

describe("organizationController - createOrJoinOrganization", () => {
  let req;
  let res;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: { id: "user123" },
      body: { name: "Test Org" },
      query: {},
      params: {},
      app: {
        get: vi.fn().mockReturnValue({}), // mock io
      },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it("should return 401 if user is not authenticated", async () => {
    req.user = null;

    await createOrJoinOrganization(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Authentication failed.",
    });
  });

  it("should return 400 if organization name is missing", async () => {
    req.body.name = "";

    await createOrJoinOrganization(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Please provide an organization name.",
    });
  });

  it("should create a new organization if it does not exist", async () => {
    const mockResult = {
      success: true,
      message: "Organization created successfully!",
      userData: {
        name: "Test User",
        role: "Admin",
        organization: {
          _id: "org123",
          name: "Test Org",
        },
      },
    };

    OrganizationService.createOrJoinOrganization.mockResolvedValue(mockResult);

    await createOrJoinOrganization(req, res);

    expect(OrganizationService.createOrJoinOrganization).toHaveBeenCalledWith(
      "user123",
      "Test Org",
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Organization created successfully!",
      }),
    );
  });

  it("should join an existing organization", async () => {
    const mockResult = {
      success: true,
      message: "Joined existing organization successfully.",
      userData: {
        name: "Test User",
        role: "Member",
        organization: {
          _id: "org123",
          name: "Test Org",
        },
      },
    };

    OrganizationService.createOrJoinOrganization.mockResolvedValue(mockResult);

    await createOrJoinOrganization(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Joined existing organization successfully.",
      }),
    );
  });

  it("should return 500 on service error without statusCode", async () => {
    OrganizationService.createOrJoinOrganization.mockRejectedValue(
      new Error("Database connection failed"),
    );

    await createOrJoinOrganization(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Database connection failed",
    });
  });

  it("should forward typed error status codes from the service", async () => {
    const error = new Error("Organization not found.");
    error.statusCode = 404;
    OrganizationService.createOrJoinOrganization.mockRejectedValue(error);

    await createOrJoinOrganization(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Organization not found.",
    });
  });
});

describe("organizationController - getOrganizationSettings & updateOrganization", () => {
  let req;
  let res;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: { id: "user123" },
      body: {},
      query: {},
      params: {},
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it("getOrganizationSettings should call service and return 200", async () => {
    const mockPayload = {
      success: true,
      organization: { _id: "org123", name: "Acme" },
      userRole: "owner",
      canEdit: true,
    };
    OrganizationService.getOrganizationSettings.mockResolvedValue(mockPayload);

    await getOrganizationSettings(req, res);

    expect(OrganizationService.getOrganizationSettings).toHaveBeenCalledWith(
      "user123",
      null,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("updateOrganization should call service and return updated organization", async () => {
    req.params.id = "org123";
    req.body = { name: "Updated Acme", contactEmail: "contact@acme.com" };

    const mockResult = {
      success: true,
      message: "Organization settings updated successfully.",
      organization: { _id: "org123", name: "Updated Acme" },
    };
    OrganizationService.updateOrganization.mockResolvedValue(mockResult);

    await updateOrganization(req, res);

    expect(OrganizationService.updateOrganization).toHaveBeenCalledWith(
      "user123",
      "org123",
      req.body,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });
});
