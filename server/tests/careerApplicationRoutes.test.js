import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";

const mockSubmitCareerApplication = jest.fn();
const mockFind = jest.fn();
const mockFindByIdAndUpdate = jest.fn();
const mockUserAuth = jest.fn((req, res, next) => {
  req.user = { _id: "admin-1", role: "admin" };
  next();
});
const mockRequirePermission = jest.fn(
  (_resource, _action) => (req, res, next) => {
    next();
  },
);

jest.unstable_mockModule("../services/careerApplicationService.js", () => ({
  submitCareerApplication: (...args) => mockSubmitCareerApplication(...args),
  removeUploadedFile: jest.fn(),
}));

jest.unstable_mockModule("../models/careerApplicationModel.js", () => ({
  default: {
    find: (...args) => mockFind(...args),
    findByIdAndUpdate: (...args) => mockFindByIdAndUpdate(...args),
  },
}));

jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => mockUserAuth(req, res, next),
}));

jest.unstable_mockModule("../middleware/rbac.js", () => ({
  requirePermission: (resource, action) =>
    mockRequirePermission(resource, action),
  requireRole: jest.fn(),
  requireAdminOrOwner: jest.fn(),
  requireOrgMembership: jest.fn(),
}));

const errorHandler = (await import("../middleware/errorHandler.js")).default;
const { createCareerRoutes } = await import("../routes/careerRoutes.js");
const { ValidationError, ConflictError } = await import("../utils/errors.js");

const buildCareersApp = () => {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/careers",
    createCareerRoutes({
      submitLimiter: (_req, _res, next) => next(),
    }),
  );
  app.use(errorHandler);
  return app;
};

describe("POST /api/careers/applications (#1790)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmitCareerApplication.mockResolvedValue({ id: "app-123" });
  });

  it("accepts multipart applications with a resume file", async () => {
    const app = buildCareersApp();

    const res = await request(app)
      .post("/api/careers/applications")
      .field("name", "Jane Doe")
      .field("email", "jane@example.com")
      .field("jobId", "ai-engineer")
      .field("portfolio", "https://github.com/jane")
      .field("coverLetter", "I build AI products.")
      .attach("resume", Buffer.from("%PDF-1.4 test"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Application submitted successfully.",
        applicationId: "app-123",
      }),
    );
    expect(res.body).not.toHaveProperty("email");
    expect(res.body).not.toHaveProperty("resume");

    expect(mockSubmitCareerApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Jane Doe",
        email: "jane@example.com",
        jobId: "ai-engineer",
        resumeFile: expect.objectContaining({
          originalname: "resume.pdf",
          mimetype: "application/pdf",
        }),
      }),
    );
  });

  it("returns validation errors from the service layer", async () => {
    mockSubmitCareerApplication.mockRejectedValueOnce(
      new ValidationError("Please provide a valid email address."),
    );

    const app = buildCareersApp();
    const res = await request(app)
      .post("/api/careers/applications")
      .field("name", "Jane Doe")
      .field("email", "bad-email")
      .field("jobId", "general")
      .attach("resume", Buffer.from("%PDF-1.4 test"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Please provide a valid email address.",
      }),
    );
  });

  it("returns conflict errors for duplicate applications", async () => {
    mockSubmitCareerApplication.mockRejectedValueOnce(
      new ConflictError(
        "You have already submitted an application for this role.",
      ),
    );

    const app = buildCareersApp();
    const res = await request(app)
      .post("/api/careers/applications")
      .field("name", "Jane Doe")
      .field("email", "jane@example.com")
      .field("jobId", "general")
      .attach("resume", Buffer.from("%PDF-1.4 test"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "You have already submitted an application for this role.",
    );
  });

  it("rejects unsupported resume file types before hitting the service", async () => {
    const app = buildCareersApp();
    const res = await request(app)
      .post("/api/careers/applications")
      .field("name", "Jane Doe")
      .field("email", "jane@example.com")
      .field("jobId", "general")
      .attach("resume", Buffer.from("not a resume"), {
        filename: "resume.exe",
        contentType: "application/octet-stream",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid resume file/i);
    expect(mockSubmitCareerApplication).not.toHaveBeenCalled();
  });

  it("requires a resume attachment", async () => {
    const app = buildCareersApp();
    const res = await request(app)
      .post("/api/careers/applications")
      .field("name", "Jane Doe")
      .field("email", "jane@example.com")
      .field("jobId", "general");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Resume file is required.");
    expect(mockSubmitCareerApplication).not.toHaveBeenCalled();
  });
});

describe("Admin Review Queue Endpoints (#2262)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/careers/admin/applications", () => {
    it("returns a list of applications for admins", async () => {
      const mockApps = [
        {
          _id: "app-1",
          fullName: "Alice Smith",
          jobId: "ai-engineer",
          status: "received",
        },
      ];
      mockFind.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockApps),
      });

      mockUserAuth.mockImplementationOnce((req, res, next) => {
        req.user = { _id: "admin-1", role: "admin" };
        next();
      });

      const app = buildCareersApp();
      const res = await request(app)
        .get("/api/careers/admin/applications")
        .query({ status: "received" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockApps);
      expect(mockFind).toHaveBeenCalledWith({ status: "received" });
    });

    it("rejects unauthorized users with 403 Forbidden via permission check", async () => {
      mockRequirePermission.mockImplementationOnce(
        (_resource, _action) => (req, res, _next) => {
          return res.status(403).json({ success: false, message: "Forbidden" });
        },
      );

      const app = buildCareersApp();
      const res = await request(app).get("/api/careers/admin/applications");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("PATCH /api/careers/admin/applications/:id/status", () => {
    it("updates status and admin notes for admins", async () => {
      const updatedApp = {
        _id: "app-1",
        status: "reviewing",
        adminNotes: "Good CV",
        reviewedBy: "admin-1",
      };

      mockFindByIdAndUpdate.mockResolvedValue(updatedApp);

      mockUserAuth.mockImplementationOnce((req, res, next) => {
        req.user = { _id: "admin-1", role: "admin" };
        next();
      });

      const app = buildCareersApp();
      const res = await request(app)
        .patch("/api/careers/admin/applications/app-1/status")
        .send({ status: "reviewing", adminNotes: "Good CV" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(updatedApp);
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        "app-1",
        expect.objectContaining({
          status: "reviewing",
          adminNotes: "Good CV",
          reviewedBy: "admin-1",
        }),
        { new: true },
      );
    });

    it("returns 400 Bad Request for unsupported status", async () => {
      const app = buildCareersApp();
      const res = await request(app)
        .patch("/api/careers/admin/applications/app-1/status")
        .send({ status: "INVALID_STATUS" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid status option.");
    });
  });
});
