import request from "supertest";
import { app } from "../server.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";
import User from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";
import Policy from "../models/policyModel.js";
import mongoose from "mongoose";

describe("Analytics Routes Integration Tests", () => {
  let token;
  let user;
  let organizationId;

  beforeEach(async () => {
    organizationId = new mongoose.Types.ObjectId();
    user = await User.create({
      name: "Analytics Test User",
      email: "analytics_test@test.com",
      password: "password123",
      role: "member",
      organization: organizationId,
    });
    user.clerkUserId = `user_test_${user._id}`;
    await user.save();

    token = createClerkTestToken({
      clerkUserId: user.clerkUserId,
      email: user.email,
    });
  });

  describe("GET /api/analytics", () => {
    it("should return 401 Unauthorized if token is missing", async () => {
      const res = await request(app).get("/api/analytics");
      expect(res.statusCode).toBe(401);
    });

    it("should return correct summary and monthly trends for user's organization", async () => {
      // Create some meetings inside and outside organization
      await Meeting.create([
        {
          title: "Org Meeting 1",
          date: new Date(),
          organization: organizationId,
          uploadedBy: user._id,
          status: "completed",
          participants: [],
        },
        {
          title: "Org Meeting 2",
          date: new Date(),
          organization: organizationId,
          uploadedBy: user._id,
          status: "pending",
          participants: [],
        },
        {
          title: "External Meeting",
          date: new Date(),
          organization: new mongoose.Types.ObjectId(),
          uploadedBy: new mongoose.Types.ObjectId(),
          status: "completed",
          participants: [],
        },
      ]);

      // Create some policies inside and outside organization
      await Policy.create([
        {
          title: "Org Policy 1",
          organization: organizationId,
          uploadedBy: user._id,
          version: "1.0",
        },
        {
          title: "Org Policy 2",
          organization: organizationId,
          uploadedBy: user._id,
          version: "2.0", // updated policy
        },
      ]);

      const res = await request(app)
        .get("/api/analytics")
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary).toEqual(
        expect.objectContaining({
          totalMeetings: 2,
          completedMeetings: 1,
          totalPolicies: 2,
          updatedPolicies: 1,
        }),
      );
      expect(res.body.trends).toBeDefined();
      expect(res.body.trends.monthlyMeetings).toBeInstanceOf(Array);
      expect(res.body.trends.monthlyPolicies).toBeInstanceOf(Array);
    });
  });

  describe("GET /api/analytics/team/:teamId/summary (migrated from orphan)", () => {
    it("should return 401 without authentication", async () => {
      const res = await request(app).get(
        `/api/analytics/team/${organizationId}/summary`,
      );
      expect(res.statusCode).toBe(401);
    });

    it("should return org-scoped summary when teamId matches caller organization", async () => {
      await Meeting.create({
        title: "Analyzed Meeting",
        date: new Date(),
        organization: organizationId,
        uploadedBy: user._id,
        duration: 45,
        participants: [],
      });

      // Seed analytics via MeetingAnalytics model used by the canonical stack
      const MeetingAnalytics = (await import("../models/MeetingAnalytics.js"))
        .default;
      const meeting = await Meeting.findOne({ title: "Analyzed Meeting" });
      await MeetingAnalytics.create({
        meeting: meeting._id,
        organization: organizationId,
        engagementScore: 80,
        efficiencyScore: 70,
        duration: 45,
        participationBalanceScore: 0.2,
        status: "completed",
      });

      const res = await request(app)
        .get(`/api/analytics/team/${organizationId}/summary`)
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalMeetings).toBe(1);
      expect(res.body.data.avgEngagement).toBe(80);
    });

    it("should not return another organization's analytics via foreign teamId", async () => {
      const otherOrg = new mongoose.Types.ObjectId();
      const MeetingAnalytics = (await import("../models/MeetingAnalytics.js"))
        .default;
      const foreignMeeting = await Meeting.create({
        title: "Foreign Meeting",
        date: new Date(),
        organization: otherOrg,
        uploadedBy: new mongoose.Types.ObjectId(),
        participants: [],
      });
      await MeetingAnalytics.create({
        meeting: foreignMeeting._id,
        organization: otherOrg,
        engagementScore: 99,
        efficiencyScore: 99,
        duration: 30,
        status: "completed",
      });

      const res = await request(app)
        .get(`/api/analytics/team/${otherOrg}/summary`)
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      // Scoped to caller's org + foreign teamId filter → empty aggregate
      expect(res.body.data.totalMeetings || 0).toBe(0);
      expect(res.body.data.avgEngagement).toBeUndefined();
    });
  });

  describe("GET /api/analytics/meeting/:meetingId (singular alias)", () => {
    it("should reject unauthenticated access", async () => {
      const id = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/analytics/meeting/${id}`);
      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/analytics/org-timeline", () => {
    it("should reject unauthenticated access", async () => {
      const res = await request(app).get("/api/analytics/org-timeline");
      expect(res.statusCode).toBe(401);
    });

    it("should return a paginated chronological list of meetings with counts", async () => {
      await Meeting.create({
        title: "Timeline Meeting 1",
        date: new Date(Date.now() - 3600000), // 1 hour ago
        organization: organizationId,
        uploadedBy: user._id,
        status: "completed",
        participants: [{ name: "Alice" }],
        tags: ["sprint-review"],
      });

      const m2 = await Meeting.create({
        title: "Timeline Meeting 2",
        date: new Date(), // Now
        organization: organizationId,
        uploadedBy: user._id,
        status: "completed",
        participants: [{ name: "Alice" }, { name: "Bob" }],
        tags: ["planning"],
      });

      const Decision = (await import("../models/decisionModel.js")).default;
      const ActionItem = (await import("../models/actionItemModel.js")).default;

      await Decision.create({
        text: "Decision 1",
        sourceMeetingId: m2._id,
        organization: organizationId,
      });

      await ActionItem.create({
        text: "Action Item 1",
        sourceMeetingId: m2._id,
        organization: organizationId,
      });

      const res = await request(app)
        .get("/api/analytics/org-timeline?page=1&limit=10")
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);

      // Verify chronological sorting (latest/newest first, meeting 2 then meeting 1)
      expect(res.body.data[0].title).toBe("Timeline Meeting 2");
      expect(res.body.data[0].counts.decisions).toBe(1);
      expect(res.body.data[0].counts.actionItems).toBe(1);
      expect(res.body.data[0].counts.attendees).toBe(2);

      expect(res.body.data[1].title).toBe("Timeline Meeting 1");
      expect(res.body.data[1].counts.decisions).toBe(0);
      expect(res.body.data[1].counts.actionItems).toBe(0);
      expect(res.body.data[1].counts.attendees).toBe(1);
    });

    it("should filter meetings by tag", async () => {
      await Meeting.create([
        {
          title: "Tag Match Meeting",
          date: new Date(),
          organization: organizationId,
          uploadedBy: user._id,
          status: "completed",
          tags: ["marketing-tag"],
          participants: [],
        },
        {
          title: "Tag Other Meeting",
          date: new Date(),
          organization: organizationId,
          uploadedBy: user._id,
          status: "completed",
          tags: ["sales-tag"],
          participants: [],
        },
      ]);

      const res = await request(app)
        .get("/api/analytics/org-timeline?tag=marketing-tag")
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe("Tag Match Meeting");
    });

    it("should filter meetings by teamId via MeetingAnalytics", async () => {
      const targetMeeting = await Meeting.create({
        title: "Team Match Meeting",
        date: new Date(),
        organization: organizationId,
        uploadedBy: user._id,
        status: "completed",
        participants: [],
      });

      const otherMeeting = await Meeting.create({
        title: "Team Other Meeting",
        date: new Date(),
        organization: organizationId,
        uploadedBy: user._id,
        status: "completed",
        participants: [],
      });

      const MeetingAnalytics = (await import("../models/MeetingAnalytics.js"))
        .default;
      const teamObjId = new mongoose.Types.ObjectId();

      await MeetingAnalytics.create([
        {
          meeting: targetMeeting._id,
          organization: organizationId,
          teamId: teamObjId,
          status: "completed",
        },
        {
          meeting: otherMeeting._id,
          organization: organizationId,
          teamId: new mongoose.Types.ObjectId(),
          status: "completed",
        },
      ]);

      const res = await request(app)
        .get(`/api/analytics/org-timeline?teamId=${teamObjId}`)
        .set(authHeader(token));

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe("Team Match Meeting");
      expect(res.body.data[0].teamName).toBe("Engineering Core"); // matching mock teamId conversion or similar logic
    });
  });
});
