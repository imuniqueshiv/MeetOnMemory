import request from "supertest";
import { app } from "../server.js";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";
import path from "path";
import fs from "fs";

let userToken;
let testUser;
const orgId = new mongoose.Types.ObjectId().toString();

beforeEach(async () => {
  await User.deleteMany({ email: /avatar-upload.*@example\.com/ });

  testUser = await User.create({
    name: "Avatar Tester",
    email: `avatar-upload-${Date.now()}@example.com`,
    password: "Password123!",
    role: "member",
    organization: orgId,
    clerkUserId: `user_avatar_${Date.now()}`,
  });

  userToken = createClerkTestToken({
    clerkUserId: testUser.clerkUserId,
    email: testUser.email,
  });
});

describe("User Avatar Multipart Upload API (#2479)", () => {
  it("should successfully upload a valid image avatar", async () => {
    // Create a dummy image buffer
    const dummyImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );

    const res = await request(app)
      .post("/api/user/avatar")
      .set(authHeader(userToken))
      .attach("avatar", dummyImage, {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profilePic).toContain("/uploads/avatars/avatar-");

    // Verify it is updated in the database
    const dbUser = await User.findById(testUser._id);
    expect(dbUser.profilePic).toBe(res.body.data.profilePic);

    // Clean up uploaded file on disk
    const filePath = path.resolve(res.body.data.profilePic.substring(1));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  it("should reject invalid file types (e.g. text file)", async () => {
    const dummyTextFile = Buffer.from("hello world");

    const res = await request(app)
      .post("/api/user/avatar")
      .set(authHeader(userToken))
      .attach("avatar", dummyTextFile, {
        filename: "test.txt",
        contentType: "text/plain",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Only images");
  });
});
