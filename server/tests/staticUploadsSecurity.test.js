import request from "supertest";
import express from "express";
import { configureExpress, configureErrorHandling } from "../config/express.js";
import fs from "fs";
import path from "path";

// Set up a mini app for testing the static mounts
const app = express();
configureExpress(app);
configureErrorHandling(app);

describe("Static Uploads Security", () => {
  const testUploadsDir = path.resolve("uploads");
  const testAttachmentsDir = path.join(testUploadsDir, "attachments");
  const testRecordingsDir = path.join(testUploadsDir, "recordings");
  const testAvatarsDir = path.join(testUploadsDir, "avatars");

  beforeAll(() => {
    // Create test directories and files
    if (!fs.existsSync(testUploadsDir))
      fs.mkdirSync(testUploadsDir, { recursive: true });
    if (!fs.existsSync(testAttachmentsDir))
      fs.mkdirSync(testAttachmentsDir, { recursive: true });
    if (!fs.existsSync(testRecordingsDir))
      fs.mkdirSync(testRecordingsDir, { recursive: true });
    if (!fs.existsSync(testAvatarsDir))
      fs.mkdirSync(testAvatarsDir, { recursive: true });

    fs.writeFileSync(
      path.join(testAttachmentsDir, "secret.txt"),
      "secret attachment",
    );
    fs.writeFileSync(
      path.join(testRecordingsDir, "secret.mp4"),
      "secret recording",
    );
    fs.writeFileSync(path.join(testAvatarsDir, "public.jpg"), "public avatar");
  });

  afterAll(() => {
    // Clean up
    fs.unlinkSync(path.join(testAttachmentsDir, "secret.txt"));
    fs.unlinkSync(path.join(testRecordingsDir, "secret.mp4"));
    fs.unlinkSync(path.join(testAvatarsDir, "public.jpg"));
  });

  it("should return 404 for unauthenticated direct access to attachments", async () => {
    const res = await request(app).get("/uploads/attachments/secret.txt");
    expect(res.status).toBe(404);
  });

  it("should return 404 for unauthenticated direct access to recordings", async () => {
    const res = await request(app).get("/uploads/recordings/secret.mp4");
    expect(res.status).toBe(404);
  });

  it("should serve avatars publicly", async () => {
    const res = await request(app).get("/uploads/avatars/public.jpg");
    expect(res.status).toBe(200);
  });
});
