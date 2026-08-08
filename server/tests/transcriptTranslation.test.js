import { jest } from "@jest/globals";
// Mock CSRF middleware before importing app
jest.mock("../middleware/csrfProtection.js", () => ({
  csrfMiddleware: (req, res, next) => next(),
  csrfTokenProvider: (req, res, next) => next(),
}));
import mongoose from "mongoose";
import request from "supertest";
import { app } from "../server.js";
import Transcript from "../models/transcriptModel.js";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import jwt from "jsonwebtoken";

describe("POST /api/transcripts/meeting/:meetingId/translate Authorization", () => {
  let uploaderToken, viewerToken, externalToken, adminToken;
  let meetingId;

  beforeAll(async () => {
    process.env.JWT_SECRET = "testsecret";

    // Generate valid ObjectIds
    const orgId = new mongoose.Types.ObjectId();
    const otherOrgId = new mongoose.Types.ObjectId();
    const uploaderId = new mongoose.Types.ObjectId();
    const viewerId = new mongoose.Types.ObjectId();
    const externalId = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();
    meetingId = new mongoose.Types.ObjectId();

    // Setup mocks
    jest.spyOn(User, "findById").mockImplementation((id) => {
      const users = {
        [uploaderId.toString()]: {
          _id: uploaderId,
          organization: orgId,
          role: "member",
        },
        [viewerId.toString()]: {
          _id: viewerId,
          organization: orgId,
          role: "member",
        },
        [externalId.toString()]: {
          _id: externalId,
          organization: otherOrgId,
          role: "member",
        },
        [adminId.toString()]: {
          _id: adminId,
          organization: orgId,
          role: "admin",
        },
      };
      return {
        select: () => Promise.resolve(users[id.toString()]),
      };
    });

    jest.spyOn(Meeting, "findById").mockImplementation((id) => {
      if (id.toString() === meetingId.toString()) {
        return Promise.resolve({
          _id: meetingId,
          organization: orgId,
          uploadedBy: uploaderId,
        });
      }
      return Promise.resolve(null);
    });

    jest.spyOn(Transcript, "findOne").mockImplementation(({ meeting }) => {
      if (meeting.toString() === meetingId.toString()) {
        return {
          populate: () =>
            Promise.resolve({
              _id: new mongoose.Types.ObjectId(),
              meeting: {
                _id: meetingId,
                organization: orgId,
                uploadedBy: uploaderId,
              },
              fullText: "Hello world",
            }),
        };
      }
      return { populate: () => Promise.resolve(null) };
    });

    // We will simulate JWT generation
    uploaderToken = jwt.sign(
      { id: uploaderId, role: "member" },
      process.env.JWT_SECRET,
    );
    viewerToken = jwt.sign(
      { id: viewerId, role: "member" },
      process.env.JWT_SECRET,
    );
    externalToken = jwt.sign(
      { id: externalId, role: "member" },
      process.env.JWT_SECRET,
    );
    adminToken = jwt.sign(
      { id: adminId, role: "admin" },
      process.env.JWT_SECRET,
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("should reject translation request without a token (401)", async () => {
    const res = await request(app).post(
      `/api/transcripts/meeting/${meetingId}/translate`,
    );
    expect(res.status).toBe(401);
  });

  it("should reject translation request for a user outside the organization (403)", async () => {
    const res = await request(app)
      .post(`/api/transcripts/meeting/${meetingId}/translate`)
      .set("Cookie", [`token=${externalToken}`]);
    expect(res.status).toBe(403);
  });

  it("should reject translation request for an organization member who is not the uploader or admin (403)", async () => {
    const res = await request(app)
      .post(`/api/transcripts/meeting/${meetingId}/translate`)
      .set("Cookie", [`token=${viewerToken}`]);
    expect(res.status).toBe(403);
    expect(res.body.message).toContain(
      "Forbidden: You do not own this meeting",
    );
  });

  it("should allow translation request for the uploader (200)", async () => {
    const res = await request(app)
      .post(`/api/transcripts/meeting/${meetingId}/translate`)
      .set("Cookie", [`token=${uploaderToken}`]);
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("Translation authorized");
  });

  it("should allow translation request for an admin (200)", async () => {
    const res = await request(app)
      .post(`/api/transcripts/meeting/${meetingId}/translate`)
      .set("Cookie", [`token=${adminToken}`]);
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("Translation authorized");
  });
});
