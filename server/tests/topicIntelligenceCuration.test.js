import request from "supertest";
import { app } from "../server.js";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import TopicCluster from "../models/topicClusterModel.js";
import TopicIntelligence from "../models/topicIntelligenceModel.js";
import MeetingTopic from "../models/meetingTopicModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

let adminToken;
let memberToken;
let adminUser;
let memberUser;
const orgId = "650c82f0c7e2b819f8a3d123";

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({ email: /curator.*@example\.com/ }),
    TopicCluster.deleteMany({ organization: orgId }),
    TopicIntelligence.deleteMany({ organization: orgId }),
    MeetingTopic.deleteMany({ organization: orgId }),
  ]);

  // Create Admin
  adminUser = await User.create({
    name: "Admin Curator",
    email: `curator-admin-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: orgId,
    clerkUserId: `user_admin_${Date.now()}`,
  });

  // Create Member
  memberUser = await User.create({
    name: "Member User",
    email: `curator-member-${Date.now()}@example.com`,
    password: "Password123!",
    role: "member",
    organization: orgId,
    clerkUserId: `user_member_${Date.now()}`,
  });

  adminToken = createClerkTestToken({
    clerkUserId: adminUser.clerkUserId,
    email: adminUser.email,
  });

  memberToken = createClerkTestToken({
    clerkUserId: memberUser.clerkUserId,
    email: memberUser.email,
  });
});

describe("Topic Intelligence Curator Operations API (#2472)", () => {
  it("should allow admin to pin/unpin topics, and block standard members", async () => {
    const cluster = await TopicCluster.create({
      organization: orgId,
      label: "Tech Debt",
      meetingCount: 2,
      centroidEmbedding: [0.1, 0.2, 0.3],
    });

    // 1. Check member is blocked
    const memberRes = await request(app)
      .put(`/api/topic-intelligence/${cluster._id}/pin`)
      .set(authHeader(memberToken))
      .send({ isPinned: true });
    expect(memberRes.statusCode).toBe(403);

    // 2. Check admin is allowed
    const adminRes = await request(app)
      .put(`/api/topic-intelligence/${cluster._id}/pin`)
      .set(authHeader(adminToken))
      .send({ isPinned: true });
    expect(adminRes.statusCode).toBe(200);
    expect(adminRes.body.cluster.isPinned).toBe(true);

    // Verify DB update
    const updated = await TopicCluster.findById(cluster._id);
    expect(updated.isPinned).toBe(true);
  });

  it("should allow admin to hide/unhide topics, and filter hidden from dashboard unless requested", async () => {
    const cluster = await TopicCluster.create({
      organization: orgId,
      label: "Unwanted Topic",
      meetingCount: 1,
      centroidEmbedding: [0.1, 0.2, 0.3],
    });

    await TopicIntelligence.create({
      organization: orgId,
      clusterId: cluster._id,
      weekStarting: new Date("2026-08-24"),
      occurrences: 5,
    });

    // 1. Hide topic
    const hideRes = await request(app)
      .put(`/api/topic-intelligence/${cluster._id}/hide`)
      .set(authHeader(adminToken))
      .send({ isHidden: true });
    expect(hideRes.statusCode).toBe(200);
    expect(hideRes.body.cluster.isHidden).toBe(true);

    // 2. Get dashboard (should filter out hidden by default)
    const dashDefaultRes = await request(app)
      .get("/api/topic-intelligence/dashboard")
      .set(authHeader(adminToken));
    expect(dashDefaultRes.statusCode).toBe(200);
    expect(dashDefaultRes.body.trends.length).toBe(0);

    // 3. Get dashboard with includeHidden=true
    const dashAllRes = await request(app)
      .get("/api/topic-intelligence/dashboard?includeHidden=true")
      .set(authHeader(adminToken));
    expect(dashAllRes.statusCode).toBe(200);
    expect(dashAllRes.body.trends.length).toBe(1);
    expect(dashAllRes.body.trends[0].label).toBe("Unwanted Topic");
  });

  it("should allow merging two topics and aggregate their statistics and references", async () => {
    const sourceCluster = await TopicCluster.create({
      organization: orgId,
      label: "React",
      meetingCount: 3,
      centroidEmbedding: [0.1, 0.2, 0.3],
      canonicalTopicNames: ["ReactJS"],
    });

    const targetCluster = await TopicCluster.create({
      organization: orgId,
      label: "Frontend",
      meetingCount: 5,
      centroidEmbedding: [0.1, 0.2, 0.4],
      canonicalTopicNames: ["WebDev"],
    });

    // Add MeetingTopic reference to source
    await MeetingTopic.create({
      meeting: new mongoose.Types.ObjectId(),
      organization: orgId,
      topics: [
        {
          name: "ReactJS",
          confidence: 90,
          timeRanges: [{ start: 0, end: 10 }],
          keywords: ["react"],
          embedding: [0.1, 0.2, 0.3],
          clusterId: sourceCluster._id,
        },
      ],
    });

    // Add weekly stats to both clusters for the same week
    const week = new Date("2026-08-24");
    await TopicIntelligence.create({
      organization: orgId,
      clusterId: sourceCluster._id,
      weekStarting: week,
      occurrences: 4,
      relatedTopics: [{ clusterId: targetCluster._id, weight: 1 }],
    });

    await TopicIntelligence.create({
      organization: orgId,
      clusterId: targetCluster._id,
      weekStarting: week,
      occurrences: 6,
    });

    // Merge topics
    const mergeRes = await request(app)
      .post("/api/topic-intelligence/merge")
      .set(authHeader(adminToken))
      .send({
        sourceClusterId: sourceCluster._id,
        targetClusterId: targetCluster._id,
      });

    expect(mergeRes.statusCode).toBe(200);
    expect(mergeRes.body.success).toBe(true);

    // Verify source is deleted
    const checkSource = await TopicCluster.findById(sourceCluster._id);
    expect(checkSource).toBeNull();

    // Verify target stats are aggregated
    const checkTarget = await TopicCluster.findById(targetCluster._id);
    expect(checkTarget.meetingCount).toBe(8);
    expect(checkTarget.canonicalTopicNames).toContain("ReactJS");
    expect(checkTarget.canonicalTopicNames).toContain("WebDev");

    // Verify MeetingTopic is updated to targetClusterId
    const updatedMeetingTopic = await MeetingTopic.findOne({
      organization: orgId,
    });
    expect(updatedMeetingTopic.topics[0].clusterId.toString()).toBe(
      targetCluster._id.toString(),
    );

    // Verify TopicIntelligence is aggregated
    const updatedIntels = await TopicIntelligence.find({
      clusterId: targetCluster._id,
    });
    expect(updatedIntels.length).toBe(1);
    expect(updatedIntels[0].occurrences).toBe(10);
  });

  it("should allow admin to export topic intelligence as JSON or CSV", async () => {
    const cluster = await TopicCluster.create({
      organization: orgId,
      label: "Docker",
      meetingCount: 2,
      centroidEmbedding: [0.1, 0.2, 0.3],
    });

    await TopicIntelligence.create({
      organization: orgId,
      clusterId: cluster._id,
      weekStarting: new Date("2026-08-24"),
      occurrences: 3,
      trendDirection: "rising",
    });

    // 1. Export as JSON
    const jsonRes = await request(app)
      .get("/api/topic-intelligence/export?format=json")
      .set(authHeader(adminToken));
    expect(jsonRes.statusCode).toBe(200);
    expect(jsonRes.headers["content-type"]).toContain("application/json");
    expect(jsonRes.body.length).toBe(1);
    expect(jsonRes.body[0].topicLabel).toBe("Docker");

    // 2. Export as CSV
    const csvRes = await request(app)
      .get("/api/topic-intelligence/export?format=csv")
      .set(authHeader(adminToken));
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.headers["content-type"]).toContain("text/csv");
    expect(csvRes.text).toContain("topicLabel");
    expect(csvRes.text).toContain("Docker");
  });
});
