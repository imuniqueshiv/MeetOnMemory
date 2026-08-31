import mongoose from "mongoose";
import request from "supertest";
import Meeting from "../models/meetingModel.js";
import MeetingChecklist from "../models/meetingChecklistModel.js";
import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import jwt from "jsonwebtoken";

import { jest } from "@jest/globals";

jest.unstable_mockModule("../middleware/userAuth.js", () => {
  return {
    default: async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
          // Instead of verify, we can just blindly decode base64 for tests
          // to avoid require() issues in ESM jest.mock
          const jwt = await import("jsonwebtoken");
          const decoded = jwt.default.verify(token, process.env.JWT_SECRET);

          req.user = { id: decoded.id, _id: decoded.id, role: decoded.role };
          req.auth = { clerkUserId: "mockClerkId" };
          return next();
        } catch (err) {
          console.error("Mock Auth Error:", err);
          return res
            .status(401)
            .json({ success: false, message: "Unauthorized" });
        }
      }
      return res.status(401).json({ success: false, message: "No token" });
    },
  };
});

jest.unstable_mockModule("../services/documentGenerator.js", () => {
  return {
    default: {
      renderHTML: () => "",
      generatePDF: async () => Buffer.from(""),
      generateDOCX: async () => Buffer.from(""),
      sanitizeHTML: () => "",
    },
  };
});

// Since unstable_mockModule is used, we must use dynamic import for the app
const { app } = await import("../server.js");

process.env.CLERK_TEST_AUTH = "jwt";

describe("Meeting Checklist API", () => {
  let user;
  let otherUser;
  let organization;
  let meeting;
  let token;
  let otherToken;

  beforeEach(async () => {
    const userId = new mongoose.Types.ObjectId();

    // Setup users and organization
    organization = await Organization.create({
      name: "Test Org",
      slug: "test-org-" + Date.now(),
      owner: userId,
    });

    user = await User.create({
      _id: userId,
      name: "Test User",
      email: "test@example.com",
      password: "password",
      organization: organization._id,
    });

    otherUser = await User.create({
      name: "Other User",
      email: "other@example.com",
      password: "password",
      organization: organization._id,
    });

    token = jwt.sign({ id: user._id, role: "user" }, process.env.JWT_SECRET);
    otherToken = jwt.sign(
      { id: otherUser._id, role: "user" },
      process.env.JWT_SECRET,
    );

    meeting = await Meeting.create({
      title: "Test Meeting",
      owner: user._id,
      uploadedBy: user._id,
      organization: organization._id,
      participants: [
        { user: user._id, name: "Test User" },
        { user: otherUser._id, name: "Other User" },
      ],
      date: new Date().toISOString(),
    });
  });

  it("should allow the meeting owner to create a checklist", async () => {
    const res = await request(app)
      .post(`/api/meetings/${meeting._id}/checklist`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ text: "Review budget" }, { text: "Prepare slides" }],
      });

    if (res.statusCode !== 201) {
      console.error("DEBUG 500 ERROR:", res.body);
    }
    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.checklist.items.length).toBe(2);
  });

  it("should prevent non-owners from creating a checklist", async () => {
    const res = await request(app)
      .post(`/api/meetings/${meeting._id}/checklist`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({
        items: [{ text: "Hack the mainframe" }],
      });

    expect(res.statusCode).toEqual(401);
  });

  it("should allow a participant to toggle an item", async () => {
    // Setup
    await MeetingChecklist.create({
      meetingId: meeting._id,
      organization: organization._id,
      createdBy: user._id,
      items: [{ text: "Task 1" }],
      completions: [],
    });

    // Toggle on
    const res = await request(app)
      .patch(`/api/meetings/${meeting._id}/checklist/toggle`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ itemIndex: 0 });

    expect(res.statusCode).toEqual(200);
    expect(res.body.checklist.completions.length).toBe(1);
    expect(res.body.checklist.completions[0].userId.toString()).toBe(
      otherUser._id.toString(),
    );

    // Toggle off
    const res2 = await request(app)
      .patch(`/api/meetings/${meeting._id}/checklist/toggle`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ itemIndex: 0 });

    expect(res2.statusCode).toEqual(200);
    expect(res2.body.checklist.completions.length).toBe(0);
  });

  it("should allow the owner to view readiness", async () => {
    // Setup
    await MeetingChecklist.create({
      meetingId: meeting._id,
      organization: organization._id,
      createdBy: user._id,
      items: [{ text: "Task 1" }, { text: "Task 2" }],
      completions: [{ itemIndex: 0, userId: otherUser._id }],
    });

    const res = await request(app)
      .get(`/api/meetings/${meeting._id}/checklist/readiness`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.readiness).toBeDefined();

    const otherUserReadiness = res.body.readiness.find(
      (r) => r.userId.toString() === otherUser._id.toString(),
    );
    expect(otherUserReadiness.percentage).toBe(50); // 1 out of 2 tasks completed
  });

  it("should allow creating a checklist with assignee and dueDate", async () => {
    const res = await request(app)
      .post(`/api/meetings/${meeting._id}/checklist`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [
          {
            text: "Read spec",
            assignee: otherUser._id.toString(),
            dueDate: new Date().toISOString(),
          },
        ],
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.checklist.items[0].assignee._id.toString()).toEqual(
      otherUser._id.toString(),
    );
    expect(res.body.checklist.items[0].assignee.name).toEqual(otherUser.name);
    expect(res.body.checklist.items[0].dueDate).toBeDefined();
  });

  it("should allow updating a checklist with assignee and dueDate", async () => {
    // First create
    await MeetingChecklist.create({
      meetingId: meeting._id,
      organization: organization._id,
      createdBy: user._id,
      items: [{ text: "Task 1" }],
      completions: [],
    });

    const res = await request(app)
      .put(`/api/meetings/${meeting._id}/checklist`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [
          {
            text: "Updated Task 1",
            assignee: otherUser._id.toString(),
            dueDate: new Date().toISOString(),
          },
          { text: "Task 2" },
        ],
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.checklist.items.length).toBe(2);
    expect(res.body.checklist.items[0].text).toEqual("Updated Task 1");
    expect(res.body.checklist.items[0].assignee._id.toString()).toEqual(
      otherUser._id.toString(),
    );
  });

  it("should trigger reminder notifications targeting assignees", async () => {
    // Create a meeting happening in ~24h
    const tomorrow = new Date(
      Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
    ); // 24h 30m from now
    const upcomingMeeting = await Meeting.create({
      title: "Upcoming Sync",
      owner: user._id,
      uploadedBy: user._id,
      organization: organization._id,
      participants: [
        { user: user._id, name: "Test User" },
        { user: otherUser._id, name: "Other User" },
      ],
      date: tomorrow.toISOString(),
    });

    await MeetingChecklist.create({
      meetingId: upcomingMeeting._id,
      organization: organization._id,
      createdBy: user._id,
      items: [
        {
          text: "Assigned Task",
          assignee: otherUser._id,
          dueDate: tomorrow,
        },
      ],
      completions: [],
    });

    // Import job and eventBus
    const { processChecklistReminders } =
      await import("../jobs/checklistReminderJob.js");
    const { default: eventBus } = await import("../services/eventBus.js");

    const emittedNotifications = [];
    const listener = (event) => {
      emittedNotifications.push(event);
    };

    eventBus.on("notification:created", listener);

    await processChecklistReminders();

    eventBus.off("notification:created", listener);

    const reminder = emittedNotifications.find(
      (n) => n.userId === otherUser._id.toString(),
    );
    expect(reminder).toBeDefined();
    expect(reminder.type).toEqual("checklist_reminder");
    expect(reminder.data.meetingId.toString()).toEqual(
      upcomingMeeting._id.toString(),
    );
  });
});
