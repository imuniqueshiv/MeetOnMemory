import mongoose from "mongoose";
import request from "supertest";
import { app } from "../server.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";
import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import MeetingTemplate from "../models/meetingTemplateModel.js";
import TemplateLibrary from "../models/templateLibraryModel.js";

describe("Template Library API", () => {
  let orgId;
  let userId;
  let token;
  let meetingTemplateId;

  beforeAll(async () => {
    const user = new User({
      name: "Test User",
      firstName: "Test",
      lastName: "User",
      email: "testuser@example.com",
      password: "password123",
      organization: new mongoose.Types.ObjectId(), // Will be updated
    });
    await user.save();
    user.clerkUserId = `user_test_${user._id}`;
    await user.save();
    userId = user._id;

    const org = new Organization({
      name: "Test Org",
      slug: "test-org-lib",
      owner: userId,
    });
    await org.save();
    orgId = org._id;

    user.organization = orgId;
    await user.save();

    token = createClerkTestToken({
      clerkUserId: user.clerkUserId,
      email: user.email,
    });

    const template = new MeetingTemplate({
      organizationId: orgId,
      name: "Original Template",
      title: "Team Meeting",
      description: "Weekly sync",
      category: "Engineering",
      defaultDuration: 45,
      agendaBlocks: [{ title: "Updates", duration: 15 }],
      createdBy: userId,
    });
    await template.save();
    meetingTemplateId = template._id;
  });

  afterAll(async () => {
    await Organization.deleteMany({});
    await User.deleteMany({});
    await MeetingTemplate.deleteMany({});
    await TemplateLibrary.deleteMany({});
    await mongoose.connection.close();
  });

  describe("Template Library Lifecycle", () => {
    it("should publish, fetch, clone, and rate a template", async () => {
      // 1. Publish a template
      let res = await request(app)
        .post("/api/template-library")
        .set(authHeader(token))
        .send({
          templateId: meetingTemplateId,
          category: "Engineering",
          description: "Published Weekly sync",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("name", "Original Template");
      expect(res.body).toHaveProperty("category", "Engineering");
      expect(res.body).toHaveProperty("description", "Published Weekly sync");

      // 2. Fetch templates
      res = await request(app)
        .get("/api/template-library")
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.templates.length).toBe(1);
      expect(res.body.templates[0]).toHaveProperty("name", "Original Template");

      // 3. Clone template
      const libraryEntry = await TemplateLibrary.findOne({
        originalTemplateId: meetingTemplateId,
      });

      res = await request(app)
        .post(`/api/template-library/${libraryEntry._id}/clone`)
        .set(authHeader(token));

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("name", "Original Template (Clone)");

      const updatedLibraryEntry = await TemplateLibrary.findById(
        libraryEntry._id,
      );
      expect(updatedLibraryEntry.cloneCount).toBe(1);

      // 4. Rate template
      res = await request(app)
        .post(`/api/template-library/${libraryEntry._id}/rate`)
        .set(authHeader(token))
        .send({
          rating: 4,
          review: "Great template!",
        });

      expect(res.status).toBe(200);
      expect(res.body.averageRating).toBe(4);
      expect(res.body.ratings.length).toBe(1);
      expect(res.body.ratings[0].rating).toBe(4);
      expect(res.body.ratings[0].review).toBe("Great template!");
    });
  });
});
