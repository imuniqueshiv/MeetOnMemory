import request from "supertest";
import { app } from "../server.js";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import FollowUpTask from "../models/FollowUpTask.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

let userToken;
let testUser;
let meeting;
let actionItem;
let followUpTask;

const orgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({ email: /followup-snooze.*@example\.com/ }),
    Meeting.deleteMany({ organization: orgId }),
    ActionItem.deleteMany({ organization: orgId }),
    FollowUpTask.deleteMany({ organization: orgId }),
  ]);

  testUser = await User.create({
    name: "Follow-Up Tester",
    email: `followup-snooze-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: orgId,
    clerkUserId: `user_snooze_${Date.now()}`,
  });

  userToken = createClerkTestToken({
    clerkUserId: testUser.clerkUserId,
    email: testUser.email,
  });

  meeting = await Meeting.create({
    title: "Snooze Sync",
    date: new Date(),
    duration: 30,
    organization: orgId,
    uploadedBy: testUser._id,
  });

  actionItem = await ActionItem.create({
    text: "Fix memory leak issues",
    sourceMeetingId: meeting._id,
    organization: orgId,
    assignee: testUser._id,
    status: "open",
  });

  followUpTask = await FollowUpTask.create({
    actionItem: actionItem._id,
    meeting: meeting._id,
    assignee: testUser._id,
    organization: orgId,
    title: "Fix memory leak issues",
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
  });
});

describe("Follow-Up Task Snooze and Curation APIs (#2475)", () => {
  it("should successfully snooze a follow-up task", async () => {
    const snoozeTime = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours

    const res = await request(app)
      .patch(`/api/followup/tasks/${followUpTask._id}/snooze`)
      .set(authHeader(userToken))
      .send({ snoozedUntil: snoozeTime });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Task snoozed successfully");
    expect(new Date(res.body.task.snoozedUntil).toISOString()).toBe(snoozeTime);

    // Verify task is updated in the database
    const dbTask = await FollowUpTask.findById(followUpTask._id);
    expect(dbTask.snoozedUntil).toBeDefined();
  });

  it("should hide snoozed tasks from default list but show in status=snoozed query", async () => {
    const snoozeTime = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    followUpTask.snoozedUntil = new Date(snoozeTime);
    await followUpTask.save();

    // 1. Query default list (no status filter) -> should return 0 tasks because it's snoozed
    const resDefault = await request(app)
      .get("/api/followup/tasks")
      .set(authHeader(userToken))
      .send();

    expect(resDefault.statusCode).toBe(200);
    expect(resDefault.body.tasks.length).toBe(0);

    // 2. Query status=snoozed -> should return the task
    const resSnoozed = await request(app)
      .get("/api/followup/tasks?status=snoozed")
      .set(authHeader(userToken))
      .send();

    expect(resSnoozed.statusCode).toBe(200);
    expect(resSnoozed.body.tasks.length).toBe(1);
    expect(resSnoozed.body.tasks[0]._id.toString()).toBe(
      followUpTask._id.toString(),
    );
  });
});
