import request from "supertest";
import { app } from "../server.js";
import User from "../models/userModel.js";
import AiSummaryTemplate from "../models/aiSummaryTemplateModel.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

let token;
let user;

beforeEach(async () => {
  user = await User.create({
    name: "Test User",
    email: "test@example.com",
    password: "password123",
    role: "admin",
    organization: "650c82f0c7e2b819f8a3d123",
  });

  user.clerkUserId = `user_test_${user._id}`;
  await user.save();

  token = createClerkTestToken({
    clerkUserId: user.clerkUserId,
    email: user.email,
  });
});

describe("AI Summary Template API", () => {
  it("should create a new AI summary template", async () => {
    const res = await request(app)
      .post("/api/ai-summary-templates")
      .set(authHeader(token))
      .send({
        name: "Sales Call",
        description: "BANT format",
        customInstructions: "Extract BANT criteria",
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.name).toEqual("Sales Call");
    expect(res.body.organization).toBeDefined();
  });

  it("should get all AI summary templates for the organization", async () => {
    await AiSummaryTemplate.create({
      name: "Engineering Sync",
      customInstructions: "Bullet points for blockers",
      organization: "650c82f0c7e2b819f8a3d123",
      createdBy: user._id,
    });

    const res = await request(app)
      .get("/api/ai-summary-templates")
      .set(authHeader(token));

    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toEqual(1);
    expect(res.body[0].name).toEqual("Engineering Sync");
  });

  it("should prevent missing required fields", async () => {
    const res = await request(app)
      .post("/api/ai-summary-templates")
      .set(authHeader(token))
      .send({
        description: "Only description, missing name",
      });

    expect(res.statusCode).toEqual(400);
  });
});
