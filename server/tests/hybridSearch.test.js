import request from "supertest";
import { app } from "../server.js";
import mongoose from "mongoose";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import Transcript from "../models/transcriptModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

let meeting1, meeting2;
let testUser, otherOrgUser;
let userToken, _otherUserToken;

const orgId = new mongoose.Types.ObjectId().toString();
const otherOrgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  await User.deleteMany({ email: /search-.*@example\.com/ });
  await Meeting.deleteMany({ title: /Search Test.*/ });
  await Transcript.deleteMany({});

  testUser = await User.create({
    name: "Search Expert",
    email: `search-org-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: orgId,
    clerkUserId: `clerk_search_${Date.now()}`,
    team: "Marketing",
  });

  otherOrgUser = await User.create({
    name: "Other Org User",
    email: `search-other-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: otherOrgId,
    clerkUserId: `clerk_search_other_${Date.now()}`,
    team: "Finance",
  });

  userToken = createClerkTestToken({
    clerkUserId: testUser.clerkUserId,
    email: testUser.email,
  });

  _otherUserToken = createClerkTestToken({
    clerkUserId: otherOrgUser.clerkUserId,
    email: otherOrgUser.email,
  });

  meeting1 = await Meeting.create({
    title: "Search Test Sync",
    uploadedBy: testUser._id,
    organization: orgId,
    date: new Date("2026-08-20"),
    tags: ["marketing-campaign"],
    transcript: "We will allocate the main budget to social media campaigns.",
  });

  meeting2 = await Meeting.create({
    title: "Search Test Other",
    uploadedBy: otherOrgUser._id,
    organization: otherOrgId,
    date: new Date("2026-08-21"),
    tags: ["financial-budget"],
    transcript: "Quarterly review of accounting practices.",
  });

  // Create text search index
  await Transcript.create({
    meeting: meeting1._id,
    organizationId: orgId,
    fullText: "We will allocate the main budget to social media campaigns.",
    segments: [
      {
        startTime: 10,
        endTime: 20,
        speaker: "Search Expert",
        text: "We will allocate the main budget to social media campaigns.",
      },
    ],
  });
});

describe("Hybrid Vector Semantic Search with Custom Contextual Filters & AI Citations (#2590)", () => {
  it("should perform hybrid search and return AI-generated answers with citations", async () => {
    const res = await request(app)
      .post("/api/search/hybrid")
      .set(authHeader(userToken))
      .send({
        query: "social media budget allocation",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.results).toBeDefined();
    expect(data.aiAnswer).toBeDefined();
    expect(typeof data.aiAnswer).toBe("string");
  });

  it("should filter results by date range", async () => {
    const res = await request(app)
      .post("/api/search/hybrid")
      .set(authHeader(userToken))
      .send({
        query: "budget allocation",
        dateFrom: "2026-08-19",
        dateTo: "2026-08-22",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.length).toBeGreaterThan(0);
  });

  it("should exclude matches from other organizations", async () => {
    const res = await request(app)
      .post("/api/search/hybrid")
      .set(authHeader(userToken))
      .send({
        query: "accounting practices",
      });

    expect(res.statusCode).toBe(200);
    // meeting2 belongs to otherOrgId, so userToken (who belongs to orgId) should not see it
    const match = res.body.data.results.find(
      (r) => r.meetingId === meeting2._id.toString(),
    );
    expect(match).toBeUndefined();
  });
});
