import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

const mockMeetingFindById = jest.fn();
const mockUserFindById = jest.fn();

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findById: mockMeetingFindById,
  },
}));

jest.unstable_mockModule("../models/userModel.js", () => ({
  default: {
    findById: mockUserFindById,
  },
}));

// Mock csrf protection so it doesn't block supertest
jest.unstable_mockModule("../middleware/csrfProtection.js", () => ({
  csrfMiddleware: (req, res, next) => next(),
  csrfTokenProvider: (req, res, next) => next(),
}));

const { app } = await import("../server.js");

describe("Meeting Clip Authorization", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "testsecret";
  const orgId = "org123";
  const otherOrgId = "org456";
  const meetingId = "6a74b2d9ce08c6d9eb0e32c0";
  const validMongoId = "507f1f77bcf86cd799439011";

  // Mock Tokens
  const noOrgToken = jwt.sign(
    { id: "6a74b2d9ce08c6d9eb0e32c1", role: "member" },
    JWT_SECRET,
  );
  const differentOrgToken = jwt.sign(
    { id: "6a74b2d9ce08c6d9eb0e32c2", role: "member" },
    JWT_SECRET,
  );
  const correctOrgToken = jwt.sign(
    { id: "6a74b2d9ce08c6d9eb0e32c3", role: "member" },
    JWT_SECRET,
  );
  const adminToken = jwt.sign(
    { id: "6a74b2d9ce08c6d9eb0e32c4", role: "admin" },
    JWT_SECRET,
  );

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock user DB lookups for userAuth middleware
    mockUserFindById.mockImplementation((id) => {
      const mockChain = {
        select: jest.fn().mockImplementation(() => {
          if (id === "6a74b2d9ce08c6d9eb0e32c1")
            return Promise.resolve({
              _id: id,
              role: "member",
              organization: null,
            });
          if (id === "6a74b2d9ce08c6d9eb0e32c2")
            return Promise.resolve({
              _id: id,
              role: "member",
              organization: otherOrgId,
            });
          if (id === "6a74b2d9ce08c6d9eb0e32c3")
            return Promise.resolve({
              _id: id,
              role: "member",
              organization: orgId,
            });
          if (id === "6a74b2d9ce08c6d9eb0e32c4")
            return Promise.resolve({
              _id: id,
              role: "admin",
              organization: orgId,
            });
          return Promise.resolve(null);
        }),
      };
      return mockChain;
    });

    // Mock meeting DB lookups for requireOrgAccess middleware
    mockMeetingFindById.mockImplementation((id) => {
      if (id === validMongoId) {
        return Promise.resolve({ _id: validMongoId, organization: orgId });
      }
      return Promise.resolve(null);
    });
  });

  describe("GET /api/meetings/:id/clip/:clipId", () => {
    it("should reject access if no token is provided (401)", async () => {
      const res = await request(app).get(
        `/api/meetings/${validMongoId}/clip/clip123`,
      );
      expect(res.status).toBe(401);
    });

    it("should reject access if user has no organization (403)", async () => {
      const res = await request(app)
        .get(`/api/meetings/${validMongoId}/clip/clip123`)
        .set("Cookie", [`token=${noOrgToken}`]);
      expect(res.status).toBe(403);
    });

    it("should reject access if user is from a different organization (403 - IDOR protection)", async () => {
      const res = await request(app)
        .get(`/api/meetings/${validMongoId}/clip/clip123`)
        .set("Cookie", [`token=${differentOrgToken}`]);
      expect(res.status).toBe(403);
    });

    it("should allow access if user is from the same organization (200)", async () => {
      const res = await request(app)
        .get(`/api/meetings/${validMongoId}/clip/clip123`)
        .set("Cookie", [`token=${correctOrgToken}`]);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should handle deleted/archived clips appropriately (404)", async () => {
      const res = await request(app)
        .get(`/api/meetings/${validMongoId}/clip/deleted-clip-id`)
        .set("Cookie", [`token=${correctOrgToken}`]);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("deleted");
    });
  });

  describe("POST /api/meetings/:id/clip", () => {
    it("should reject access if no token is provided (401)", async () => {
      const res = await request(app)
        .post(`/api/meetings/${validMongoId}/clip`)
        .send({ data: "test" });
      expect(res.status).toBe(401);
    });

    it("should reject access if user is from a different organization (403)", async () => {
      const res = await request(app)
        .post(`/api/meetings/${validMongoId}/clip`)
        .set("Cookie", [`token=${differentOrgToken}`])
        .send({ data: "test" });
      expect(res.status).toBe(403);
    });

    it("should allow access if user is from the same organization and has edit perms (200)", async () => {
      const res = await request(app)
        .post(`/api/meetings/${validMongoId}/clip`)
        .set("Cookie", [`token=${adminToken}`])
        .send({ data: "test" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
