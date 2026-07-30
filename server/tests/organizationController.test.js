import request from "supertest";
import { app } from "../server.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createOrJoinOrganization,
  joinOrganization,
  getOrganizationSettings,
  updateOrganization,
} from "../controllers/organizationController.js";
import * as OrganizationService from "../services/OrganizationService.js";

// Mock the service layer
vi.mock("../services/OrganizationService.js", () => ({
  createOrJoinOrganization: vi.fn(),
  joinOrganizationById: vi.fn(),
  getOrganizationSettings: vi.fn(),
  updateOrganization: vi.fn(),
}));

describe("Organization Endpoints", () => {
  describe("Route verification for Issue #787", () => {
    it("should return 401 for old /api/organizations/members route (removed - now caught by auth middleware)", async () => {
      const res = await request(app).get("/api/organizations/members");

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty("success", false);
    });

    it("should return 401 for new /api/organizations/:id/members route without auth", async () => {
      const res = await request(app).get(
        "/api/organizations/507f1f77bcf86cd799439011/members",
      );

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty("success", false);
    });
  });

  describe("POST /api/organizations/create-or-join", () => {
    it("should return 401 if user is not authenticated", async () => {
      const res = await request(app)
        .post("/api/organizations/create-or-join")
        .send({ name: "Test Org" });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty("success", false);
    });
  });
});

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
        get: vi.fn().mockReturnValue({}),
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

  it("should call service and return success for create", async () => {
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

  it("should call service and return success for join", async () => {
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

describe("organizationController - joinOrganization", () => {
  let req;
  let res;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: { id: "user123" },
      body: { organizationId: "org456" },
      app: {
        get: vi.fn().mockReturnValue({}),
      },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it("should call service and return success", async () => {
    const mockResult = {
      success: true,
      message: "Joined organization successfully.",
      userData: {
        name: "Test User",
        role: "Member",
        organization: {
          _id: "org456",
          name: "Test Org",
        },
      },
    };

    OrganizationService.joinOrganizationById.mockResolvedValue(mockResult);

    await joinOrganization(req, res);

    expect(OrganizationService.joinOrganizationById).toHaveBeenCalledWith(
      "user123",
      "org456",
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Joined organization successfully.",
      }),
    );
  });

  it("should return 401 if user is not authenticated", async () => {
    req.user = null;

    await joinOrganization(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Authentication failed.",
    });
  });

  it("should return 500 on service error", async () => {
    OrganizationService.joinOrganizationById.mockRejectedValue(
      new Error("Service error"),
    );

    await joinOrganization(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Service error",
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
