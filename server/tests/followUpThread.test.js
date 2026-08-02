import request from "supertest";
import { app } from "../server.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";
import FollowUpThread from "../models/followUpThreadModel.js";
import ThreadReply from "../models/threadReplyModel.js";
import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";

describe("FollowUpThread API", () => {
  let user1, user2, meeting, user1Token;

  beforeEach(async () => {
    user1 = await User.create({
      name: "Test User 1",
      email: "user1@test.com",
      password: "password",
      role: "member",
    });
    user1.clerkUserId = `user_test_${user1._id}`;
    await user1.save();

    user2 = await User.create({
      name: "Test User 2",
      email: "user2@test.com",
      password: "password",
      role: "member",
    });
    user2.clerkUserId = `user_test_${user2._id}`;
    await user2.save();

    meeting = await Meeting.create({
      title: "Test Meeting",
      date: new Date(),
      uploadedBy: user1._id,
      status: "completed",
    });

    user1Token = createClerkTestToken({
      clerkUserId: user1.clerkUserId,
      email: user1.email,
    });
  });

  describe("POST /api/follow-up-threads/meeting/:meetingId", () => {
    it("should create a new follow-up thread", async () => {
      const res = await request(app)
        .post(`/api/follow-up-threads/meeting/${meeting._id}`)
        .set(authHeader(user1Token))
        .send({
          anchorType: "decision",
          anchorText: "Decided to use React",
          content: "Why did we choose React over Vue?",
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBeTruthy();
      expect(res.body.thread.anchorType).toBe("decision");
      expect(res.body.reply.content).toBe("Why did we choose React over Vue?");
    });
  });

  describe("POST /api/follow-up-threads/:threadId/replies", () => {
    it("should create a reply and send notification if mentioned", async () => {
      const thread = await FollowUpThread.create({
        meetingId: meeting._id,
        anchorType: "general",
        createdBy: user1._id,
      });

      const res = await request(app)
        .post(`/api/follow-up-threads/${thread._id}/replies`)
        .set(authHeader(user1Token))
        .send({
          content: "I think we should reconsider.",
          mentions: [user2._id],
          meetingId: meeting._id,
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.reply.content).toBe("I think we should reconsider.");

      const notifs = await Notification.find({ user: user2._id });
      expect(notifs.length).toBe(1);
      expect(notifs[0].title).toBe("You were mentioned in a reply");
    });
  });

  describe("PUT /api/follow-up-threads/replies/:replyId", () => {
    it("should enforce the 15-minute edit window", async () => {
      const thread = await FollowUpThread.create({
        meetingId: meeting._id,
        anchorType: "general",
        createdBy: user1._id,
      });

      const reply = await ThreadReply.create({
        threadId: thread._id,
        author: user1._id,
        content: "Original content",
      });

      // Try editing immediately
      const res1 = await request(app)
        .put(`/api/follow-up-threads/replies/${reply._id}`)
        .set(authHeader(user1Token))
        .send({
          content: "Updated content",
        });

      expect(res1.statusCode).toEqual(200);
      expect(res1.body.reply.content).toBe("Updated content");
      expect(res1.body.reply.edited).toBe(true);

      // Simulate 16 minutes passed
      const oldDate = new Date(Date.now() - 16 * 60000);
      await ThreadReply.collection.updateOne(
        { _id: reply._id },
        { $set: { createdAt: oldDate } },
      );

      const res2 = await request(app)
        .put(`/api/follow-up-threads/replies/${reply._id}`)
        .set(authHeader(user1Token))
        .send({
          content: "Updated content again",
        });

      expect(res2.statusCode).toEqual(403);
      expect(res2.body.message).toContain("expired");
    });
  });

  describe("PUT /api/follow-up-threads/:threadId/resolve", () => {
    it("should mark the thread as resolved", async () => {
      const thread = await FollowUpThread.create({
        meetingId: meeting._id,
        anchorType: "general",
        createdBy: user1._id,
      });

      const res = await request(app)
        .put(`/api/follow-up-threads/${thread._id}/resolve`)
        .set(authHeader(user1Token));

      expect(res.statusCode).toEqual(200);
      expect(res.body.thread.status).toBe("resolved");
      expect(res.body.thread.resolvedBy._id.toString()).toBe(
        user1._id.toString(),
      );
    });
  });
});
