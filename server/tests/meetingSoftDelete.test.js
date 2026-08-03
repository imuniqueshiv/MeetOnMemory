import request from "supertest";
import { app } from "../server.js";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

let owner;
let organization;
let headers;

beforeEach(async () => {
  await Promise.all([
    Meeting.deleteMany({}),
    Organization.deleteMany({}),
    User.deleteMany({ email: /recycle-owner/ }),
  ]);

  owner = await User.create({
    name: "Recycle Owner",
    email: `recycle-owner-${Date.now()}@example.com`,
    password: "Password123!",
    role: "owner",
    clerkUserId: `user_recycle_${Date.now()}`,
  });
  organization = await Organization.create({
    name: "Recycle Bin Org",
    slug: `recycle-bin-org-${Date.now()}`,
    owner: owner._id,
  });
  owner.organization = organization._id;
  await owner.save();

  headers = authHeader(
    createClerkTestToken({
      clerkUserId: owner.clerkUserId,
      email: owner.email,
    }),
  );
});

const createMeeting = () =>
  Meeting.create({
    uploadedBy: owner._id,
    organization: organization._id,
    title: "Quarterly planning",
    date: new Date(),
  });

test("soft delete hides a meeting and places it in trash", async () => {
  const meeting = await createMeeting();
  const deleted = await request(app)
    .delete(`/api/meetings/delete/${meeting._id}`)
    .set(headers)
    .send({ reason: "Duplicate" });

  expect(deleted.status).toBe(200);
  const stored = await Meeting.findById(meeting._id);
  expect(stored.deletedAt).toBeTruthy();
  expect(stored.deletedBy.toString()).toBe(owner._id.toString());

  const active = await request(app).get("/api/meetings/all").set(headers);
  expect(active.status).toBe(200);
  expect(active.body.meetings).toHaveLength(0);

  const trash = await request(app).get("/api/meetings/trash").set(headers);
  expect(trash.status).toBe(200);
  expect(trash.body.meetings).toHaveLength(1);
  expect(trash.body.meetings[0].deletionReason).toBe("Duplicate");
});

test("restores and permanently deletes meetings", async () => {
  const meeting = await createMeeting();
  meeting.deletedAt = new Date();
  meeting.deletedBy = owner._id;
  await meeting.save();

  const restored = await request(app)
    .post(`/api/meetings/${meeting._id}/restore-deleted`)
    .set(headers);
  expect(restored.status).toBe(200);
  expect((await Meeting.findById(meeting._id)).deletedAt).toBeNull();

  await Meeting.updateOne(
    { _id: meeting._id },
    { deletedAt: new Date(), deletedBy: owner._id },
  );
  const purged = await request(app)
    .delete(`/api/meetings/${meeting._id}/permanent`)
    .set(headers);
  expect(purged.status).toBe(200);
  expect(await Meeting.findById(meeting._id)).toBeNull();
});
