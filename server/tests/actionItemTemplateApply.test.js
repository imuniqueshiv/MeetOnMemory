import request from "supertest";
import { app } from "../server.js";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import ActionItemTemplate from "../models/actionItemTemplateModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

let organizerToken;
let organizerUser;
let participantUser;
let meeting;
let template;
const orgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({ email: /template-user.*@example\.com/ }),
    Meeting.deleteMany({ organization: orgId }),
    ActionItem.deleteMany({ organization: orgId }),
    ActionItemTemplate.deleteMany({ organization: orgId }),
  ]);

  // Create organizer/host
  organizerUser = await User.create({
    name: "Organizer User",
    email: `template-user-organizer-${Date.now()}@example.com`,
    password: "Password123!",
    role: "admin",
    organization: orgId,
    clerkUserId: `user_org_${Date.now()}`,
  });

  // Create another participant
  participantUser = await User.create({
    name: "Participant User",
    email: `template-user-participant-${Date.now()}@example.com`,
    password: "Password123!",
    role: "member",
    organization: orgId,
    clerkUserId: `user_part_${Date.now()}`,
  });

  organizerToken = createClerkTestToken({
    clerkUserId: organizerUser.clerkUserId,
    email: organizerUser.email,
  });

  // Create a meeting
  meeting = await Meeting.create({
    title: "Project Sync",
    date: new Date("2026-08-25T10:00:00Z"),
    duration: 60,
    status: "completed",
    organization: orgId,
    uploadedBy: organizerUser._id,
    participants: [
      {
        user: organizerUser._id,
        name: organizerUser.name,
        email: organizerUser.email,
        role: "host",
      },
      {
        user: participantUser._id,
        name: participantUser.name,
        email: participantUser.email,
        role: "facilitator",
      },
    ],
  });

  // Create Action Item Template
  template = await ActionItemTemplate.create({
    name: "Standard Sync Template",
    organization: orgId,
    applicableMeetingTypes: ["conference"],
    items: [
      {
        text: "Prepare weekly status report",
        description: "Document achievements and blockers",
        daysToComplete: 5,
        defaultOwnerRole: "host",
      },
      {
        text: "Verify test deployments",
        description: "Deploy to staging environment",
        daysToComplete: 3,
        defaultOwnerRole: "facilitator",
      },
      {
        text: "General housekeeping task",
        description: "Cleanup repository issues",
        daysToComplete: 7,
        defaultOwnerRole: "Unassigned",
      },
    ],
  });
});

describe("Action Item Templates Apply API (#2473)", () => {
  it("should successfully apply an action item template to a meeting", async () => {
    const res = await request(app)
      .post("/api/action-item-templates/apply")
      .set(authHeader(organizerToken))
      .send({
        templateId: template._id,
        meetingId: meeting._id,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Template applied successfully");
    expect(res.body.createdCount).toBe(3);

    // Verify tasks are created in the database
    const actionItems = await ActionItem.find({ sourceMeetingId: meeting._id });
    expect(actionItems.length).toBe(3);

    // 1. Check task 1 (host assignment → organizerUser)
    const hostTask = actionItems.find(
      (t) => t.text === "Prepare weekly status report",
    );
    expect(hostTask).toBeDefined();
    expect(hostTask.assignee.toString()).toBe(organizerUser._id.toString());
    expect(hostTask.owner).toBe(organizerUser.name);
    expect(hostTask.status).toBe("pending"); // Verified: status is pending
    // Verify due date: meeting date (Aug 25) + 5 days = Aug 30
    const expectedDueDateHost = new Date(meeting.date);
    expectedDueDateHost.setDate(expectedDueDateHost.getDate() + 5);
    expect(new Date(hostTask.dueDate).toISOString()).toBe(
      expectedDueDateHost.toISOString(),
    );

    // 2. Check task 2 (facilitator assignment → participantUser)
    const facilitatorTask = actionItems.find(
      (t) => t.text === "Verify test deployments",
    );
    expect(facilitatorTask).toBeDefined();
    expect(facilitatorTask.assignee.toString()).toBe(
      participantUser._id.toString(),
    );
    expect(facilitatorTask.owner).toBe(participantUser.name);
    // Verify due date: meeting date (Aug 25) + 3 days = Aug 28
    const expectedDueDateFac = new Date(meeting.date);
    expectedDueDateFac.setDate(expectedDueDateFac.getDate() + 3);
    expect(new Date(facilitatorTask.dueDate).toISOString()).toBe(
      expectedDueDateFac.toISOString(),
    );

    // 3. Check task 3 (Unassigned)
    const unassignedTask = actionItems.find(
      (t) => t.text === "General housekeeping task",
    );
    expect(unassignedTask).toBeDefined();
    expect(unassignedTask.assignee).toBeNull();
    expect(unassignedTask.owner).toBe("Unassigned");
  });

  it("should fail if templateId or meetingId is missing", async () => {
    const res = await request(app)
      .post("/api/action-item-templates/apply")
      .set(authHeader(organizerToken))
      .send({
        meetingId: meeting._id,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("templateId and meetingId are required");
  });
});
