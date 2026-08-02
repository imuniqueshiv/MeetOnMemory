import request from "supertest";
import { app } from "../server.js";
import { setupTestDB, teardownTestDB, clearTestDB } from "./setup.js";
import User from "../models/userModel.js";
import AiSummaryTemplate from "../models/aiSummaryTemplateModel.js";

let token;
let user;

beforeAll(async () => {
  await setupTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  user = await User.create({
    name: "Test User",
    email: "test@example.com",
    password: "password123",
    role: "admin",
    organization: "650c82f0c7e2b819f8a3d123",
  });

  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "test@example.com", password: "password123" });
  token = res.body.token;
});

afterAll(async () => {
  await teardownTestDB();
});

describe("AI Summary Template API", () => {
  it("should create a new AI summary template", async () => {
    const res = await request(app)
      .post("/api/ai-summary-templates")
      .set("Authorization", `Bearer ${token}`)
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
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toEqual(1);
    expect(res.body[0].name).toEqual("Engineering Sync");
  });

  it("should prevent missing required fields", async () => {
    const res = await request(app)
      .post("/api/ai-summary-templates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Only Name",
      });

    expect(res.statusCode).toEqual(400);
  });
});
