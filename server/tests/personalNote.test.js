import request from "supertest";
import { app } from "../server.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";
import PersonalNote from "../models/personalNoteModel.js";
import User from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";

describe("PersonalNote API", () => {
  let token;
  let user;
  let meeting;

  beforeEach(async () => {
    user = await User.create({
      name: "Test Note User",
      email: "noteuser@test.com",
      password: "password123",
      role: "member",
    });
    user.clerkUserId = `user_test_${user._id}`;
    await user.save();

    token = createClerkTestToken({
      clerkUserId: user.clerkUserId,
      email: user.email,
    });

    meeting = await Meeting.create({
      title: "Test Note Meeting",
      date: new Date(),
      uploadedBy: user._id,
      participants: [{ name: "Test User" }],
    });
  });

  it("should create a new personal note", async () => {
    const res = await request(app)
      .post(`/api/personal-notes/${meeting._id}`)
      .set(authHeader(token))
      .send({ content: "This is a private note." });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.note.content).toBe("This is a private note.");
  });

  it("should update an existing personal note", async () => {
    await PersonalNote.create({
      userId: user._id,
      meetingId: meeting._id,
      content: "Initial content",
    });

    const res = await request(app)
      .post(`/api/personal-notes/${meeting._id}`)
      .set(authHeader(token))
      .send({ content: "Updated content" });
    if (res.statusCode === 404)
      console.log("404 Error Body:", res.body, res.text);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.note.content).toBe("Updated content");
  });

  it("should add an annotation", async () => {
    const res = await request(app)
      .post(`/api/personal-notes/${meeting._id}/annotations`)
      .set(authHeader(token))
      .send({
        annotationText: "Important highlight",
        sourceField: "transcript",
        offsets: { start: 10, end: 30 },
        color: "#ff0000",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.note.annotations).toHaveLength(1);
    expect(res.body.note.annotations[0].annotationText).toBe(
      "Important highlight",
    );
  });

  it("should pin a note", async () => {
    const res = await request(app)
      .patch(`/api/personal-notes/${meeting._id}/pin`)
      .set(authHeader(token))
      .send({ isPinned: true });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.note.isPinned).toBe(true);
  });

  it("should fetch pinned notes", async () => {
    await PersonalNote.create({
      userId: user._id,
      meetingId: meeting._id,
      content: "Pinned note",
      isPinned: true,
    });

    const res = await request(app)
      .get(`/api/personal-notes/pinned`)
      .set(authHeader(token));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].isPinned).toBe(true);
  });

  it("should search notes", async () => {
    await PersonalNote.create({
      userId: user._id,
      meetingId: meeting._id,
      content: "Find this specific word",
    });

    // Wait for text index to build if necessary, though in memory or local test db might be instant
    await new Promise((resolve) => setTimeout(resolve, 500));

    const res = await request(app)
      .get(`/api/personal-notes/search?q=specific`)
      .set(authHeader(token));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notes.length).toBeGreaterThanOrEqual(1);
  });
});
