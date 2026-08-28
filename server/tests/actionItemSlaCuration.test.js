import request from "supertest";
import { app } from "../server.js";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import ActionItemSlaBreach from "../models/actionItemSlaBreachModel.js";
import Notification from "../models/notificationModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

let adminToken;
let memberToken;
let outsiderToken;

let adminUser;
let memberUser;
let outsiderUser;

let actionItem;
let breach;

const orgId = new mongoose.Types.ObjectId().toString();
const otherOrgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({ email: /sla-curator-user.*@example\.com/ }),
    Meeting.deleteMany({ organization: { $in: [orgId, otherOrgId] } }),
    ActionItem.deleteMany({ organization: { $in: [orgId, otherOrgId] } }),
    ActionItemSlaBreach.deleteMany({
      organization: { $in: [orgId, otherOrgId] },
    }),
    Notification.deleteMany({}),
  ]);

  // Create organization admin user
  adminUser = await User.create({
    name: "Admin User",
    email: `sla-curator-user-admin-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: orgId,
    clerkUserId: `user_sla_admin_${Date.now()}`,
  });

  // Create organization member user
  memberUser = await User.create({
    name: "Member User",
    email: `sla-curator-user-member-${Date.now()}@example.com`,
    password: "Password123!",
    role: "member",
    organization: orgId,
    clerkUserId: `user_sla_member_${Date.now()}`,
  });

  // Create outsider user (different org)
  outsiderUser = await User.create({
    name: "Outsider User",
    email: `sla-curator-user-outsider-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: otherOrgId,
    clerkUserId: `user_sla_outsider_${Date.now()}`,
  });

  adminToken = createClerkTestToken({
    clerkUserId: adminUser.clerkUserId,
    email: adminUser.email,
  });

  memberToken = createClerkTestToken({
    clerkUserId: memberUser.clerkUserId,
    email: memberUser.email,
  });

  outsiderToken = createClerkTestToken({
    clerkUserId: outsiderUser.clerkUserId,
    email: outsiderUser.email,
  });

  const meeting = await Meeting.create({
    title: "SLA Sync",
    date: new Date(),
    duration: 30,
    organization: orgId,
    uploadedBy: adminUser._id,
  });

  actionItem = await ActionItem.create({
    text: "Review SLA Compliance issues",
    sourceMeetingId: meeting._id,
    organization: orgId,
    assignee: memberUser._id,
    dueDate: new Date(),
    status: "open",
  });

  breach = await ActionItemSlaBreach.create({
    actionItem: actionItem._id,
    organization: orgId,
    assignee: memberUser._id,
    priority: "high",
    breachType: "response",
    targetHours: 4,
    actualHours: 8, // Ratio = 2.0 -> Severity critical (high priority + ratio >= 1.5)
  });
});

describe("SLA Compliance Breach alerts and assignee drill-down API (#2474)", () => {
  it("should calculate severity virtual property correctly", async () => {
    // 1. High priority + ratio = 2.0 -> severity critical
    expect(breach.severity).toBe("critical");

    // 2. High priority + ratio = 1.6 -> severity high
    breach.actualHours = 6.4; // 6.4 / 4 = 1.6
    await breach.save();
    expect(breach.severity).toBe("high");

    // 3. Medium priority + ratio = 1.2 -> severity medium
    breach.priority = "medium";
    breach.actualHours = 4.8; // 4.8 / 4 = 1.2
    await breach.save();
    expect(breach.severity).toBe("medium");

    // 4. Low priority + ratio = 1.0 -> severity low
    breach.priority = "low";
    breach.actualHours = 4.0;
    await breach.save();
    expect(breach.severity).toBe("low");
  });

  it("should block non-admin users from triggering breach notifications", async () => {
    const res = await request(app)
      .post(`/api/action-item-sla/breach/${breach._id}/notify`)
      .set(authHeader(memberToken))
      .send();

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toContain("Admin or Owner access required");
  });

  it("should allow admin users to notify assignees and create a task alert", async () => {
    const res = await request(app)
      .post(`/api/action-item-sla/breach/${breach._id}/notify`)
      .set(authHeader(adminToken))
      .send();

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Assignee notified");

    // Check that a notification is created in the database
    const notifs = await Notification.find({ user: memberUser._id });
    expect(notifs.length).toBe(1);
    expect(notifs[0].title).toBe("SLA Compliance Breach Alert");
    expect(notifs[0].category).toBe("tasks");
  });

  it("should enforce organization match param check to block cross-tenant queries", async () => {
    // Outsider tries to access orgId compliance stats
    const res = await request(app)
      .get(`/api/action-item-sla/stats/${orgId}`)
      .set(authHeader(outsiderToken))
      .send();

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toContain(
      "Forbidden: You don't have access to this resource",
    );
  });
});
