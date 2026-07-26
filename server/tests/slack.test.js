/**
 * slack.test.js
 *
 * Integration tests for the Slack Bot Integration feature.
 * Tests:
 *  1. Slack Signature Verification utility (unit)
 *  2. POST /api/slack/events - URL verification challenge
 *  3. POST /api/slack/events - /mom-create slash command (org connected)
 *  4. POST /api/slack/events - /mom-create slash command (org NOT connected)
 *  5. POST /api/slack/events - generic event_callback acknowledgement
 *  6. GET  /api/slack/install - missing organizationId
 *  7. GET  /api/slack/oauth_redirect - missing code
 */

import request from "supertest";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import axios from "axios";
import { jest } from "@jest/globals";

import { app } from "../server.js";
import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import Membership from "../models/membershipModel.js";
import { verifySlackSignature } from "../services/slackService.js";

// Test helpers

const SIGNING_SECRET = "test_signing_secret";

/**
 * Generates a valid Slack-style HMAC signature for a given body string.
 * @param {string} body - Raw body string
 * @param {number} [timestamp] - Unix timestamp (defaults to now)
 * @returns {{ signature: string, timestamp: string }}
 */
const generateSlackSignature = (
  body,
  timestamp = Math.floor(Date.now() / 1000),
) => {
  const sigBasestring = `v0:${timestamp}:${body}`;
  const signature =
    "v0=" +
    crypto
      .createHmac("sha256", SIGNING_SECRET)
      .update(sigBasestring, "utf8")
      .digest("hex");
  return { signature, timestamp: String(timestamp) };
};

// Mocks

let axiosSpy;

beforeAll(() => {
  // Prevent real HTTP calls to Slack API
  axiosSpy = jest.spyOn(axios, "post").mockResolvedValue({
    status: 200,
    data: {
      ok: true,
      access_token: "xoxb-test-token",
      team: { id: "T12345TEST", name: "Test Workspace" },
      incoming_webhook: { channel_id: "C12345TEST" },
    },
  });
  process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;
  process.env.SLACK_CLIENT_ID = "test_client_id";
  process.env.SLACK_CLIENT_SECRET = "test_client_secret";
  process.env.SLACK_REDIRECT_URI =
    "http://localhost:4000/api/slack/oauth_redirect";
});

afterAll(() => {
  axiosSpy.mockRestore();
  delete process.env.SLACK_SIGNING_SECRET;
  delete process.env.SLACK_CLIENT_ID;
  delete process.env.SLACK_CLIENT_SECRET;
});

// 1. Unit: verifySlackSignature

describe("verifySlackSignature (unit)", () => {
  it("returns valid=true for a correctly signed request", () => {
    const body = "token=test&text=hello";
    const { signature, timestamp } = generateSlackSignature(body);

    const mockReq = {
      headers: {
        "x-slack-signature": signature,
        "x-slack-request-timestamp": timestamp,
      },
      rawBody: Buffer.from(body),
    };

    const result = verifySlackSignature(mockReq);
    expect(result.valid).toBe(true);
  });

  it("returns valid=false for a tampered body", () => {
    const body = "token=test&text=hello";
    const { signature, timestamp } = generateSlackSignature(body);

    const mockReq = {
      headers: {
        "x-slack-signature": signature,
        "x-slack-request-timestamp": timestamp,
      },
      // Different body than what was signed
      rawBody: Buffer.from("token=test&text=TAMPERED"),
    };

    const result = verifySlackSignature(mockReq);
    expect(result.valid).toBe(false);
  });

  it("returns valid=false for a stale timestamp (replay attack)", () => {
    const body = "token=test&text=hello";
    const staleTimestamp = Math.floor(Date.now() / 1000) - 6 * 60; // 6 minutes ago
    const { signature } = generateSlackSignature(body, staleTimestamp);

    const mockReq = {
      headers: {
        "x-slack-signature": signature,
        "x-slack-request-timestamp": String(staleTimestamp),
      },
      rawBody: Buffer.from(body),
    };

    const result = verifySlackSignature(mockReq);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/too old/i);
  });

  it("returns valid=false when signature headers are missing", () => {
    const mockReq = {
      headers: {},
      rawBody: Buffer.from("token=test"),
    };
    const result = verifySlackSignature(mockReq);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/missing/i);
  });
});

// Integration tests — /api/slack/events
// NOTE: In NODE_ENV=test, slackSignatureMiddleware is bypassed.

describe("POST /api/slack/events", () => {
  // Case 1: URL verification challenge

  it("responds to Slack URL verification challenge", async () => {
    const res = await request(app)
      .post("/api/slack/events")
      .send({ type: "url_verification", challenge: "3eZbrw1aBm2rZgRNFdxV2595" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.challenge).toBe("3eZbrw1aBm2rZgRNFdxV2595");
  });

  // Case 2: Slash command — org connected

  it("handles /mom-create slash command and creates a meeting when org is connected", async () => {
    // Seed: org with Slack integration
    const owner = await User.create({
      name: "Slack Owner",
      email: `slackowner-${Math.random()}@example.com`,
      password: "password123",
    });

    const org = await Organization.create({
      name: "Slack Org",
      slug: "slack-org-" + Math.random().toString(36).substring(7),
      owner: owner._id,
      "slackIntegration.teamId": "TSLACKTEST",
      "slackIntegration.botToken": "xoxb-fake",
      "slackIntegration.channelId": "CTEST",
    });

    // Associate owner with org
    await User.findByIdAndUpdate(owner._id, { organization: org._id });

    // Create membership
    await Membership.create({
      user: owner._id,
      organization: org._id,
      role: "admin",
      status: "active",
    });

    const slashPayload = new URLSearchParams({
      command: "/mom-create",
      text: '"Q3 Planning" @team',
      team_id: "TSLACKTEST",
      user_name: "chirag",
      user_id: "UTEST",
    }).toString();

    const res = await request(app)
      .post("/api/slack/events")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send(slashPayload);

    expect(res.status).toBe(200);
    expect(res.body.response_type).toBe("in_channel");
    expect(res.body.text).toMatch(/Q3 Planning/i);
    expect(Array.isArray(res.body.blocks)).toBe(true);
    // The first block should be our header block
    expect(res.body.blocks[0].type).toBe("header");
  });

  // Case 3: Slash command — org NOT connected

  it("returns ephemeral error when workspace is not connected to any org", async () => {
    const slashPayload = new URLSearchParams({
      command: "/mom-create",
      text: '"Unknown Meeting"',
      team_id: "TUNKNOWN",
      user_name: "stranger",
    }).toString();

    const res = await request(app)
      .post("/api/slack/events")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send(slashPayload);

    expect(res.status).toBe(200);
    expect(res.body.response_type).toBe("ephemeral");
    expect(res.body.text).toMatch(/not connected/i);
  });

  // Case 4: Generic event_callback

  it("acknowledges generic event_callback with 200 OK", async () => {
    const res = await request(app)
      .post("/api/slack/events")
      .send({
        type: "event_callback",
        team_id: "TTEST",
        event: { type: "app_mention", text: "Hello bot" },
      })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
  });

  // Case 5: Unknown payload type

  it("returns 200 for unknown payload types", async () => {
    const res = await request(app)
      .post("/api/slack/events")
      .send({ type: "some_unknown_type" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
  });
});

// Integration tests — /api/slack/install

describe("GET /api/slack/install", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/slack/install");
    expect(res.status).toBe(401);
  });

  it("returns 400 when organizationId is missing", async () => {
    const user = await User.create({
      name: "Install User",
      email: `install-${Math.random()}@example.com`,
      password: "password123",
      role: "admin",
    });
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "fallback_secret",
    );

    const res = await request(app)
      .get("/api/slack/install")
      .set("Authorization", `Bearer ${token}`);

    // No organizationId in query or user.organization → 400
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/organizationId/i);
  });
});

// Integration tests — /api/slack/oauth_redirect

describe("GET /api/slack/oauth_redirect", () => {
  const JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";

  const createValidState = (orgId, userId) => {
    return jwt.sign(
      { orgId: orgId.toString(), userId: userId.toString() },
      JWT_SECRET,
      { expiresIn: "15m" },
    );
  };

  it("returns 400 when no code is provided", async () => {
    const fakeOrgId = new mongoose.Types.ObjectId();
    const fakeUserId = new mongoose.Types.ObjectId();
    const stateToken = createValidState(fakeOrgId, fakeUserId);

    const res = await request(app)
      .get("/api/slack/oauth_redirect")
      .query({ state: stateToken });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/code/i);
  });

  it("returns 400 when no state is provided", async () => {
    const res = await request(app)
      .get("/api/slack/oauth_redirect")
      .query({ code: "fake_code" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/oauth state/i);
  });

  it("returns 403 when user is not authorized for the organization", async () => {
    // Seed user without organization or permissions
    const user = await User.create({
      name: "Unauthorized User",
      email: `unauth-${Math.random()}@example.com`,
      password: "password123",
      role: "guest",
    });
    const fakeOrgId = new mongoose.Types.ObjectId();
    const stateToken = createValidState(fakeOrgId, user._id);

    const res = await request(app)
      .get("/api/slack/oauth_redirect")
      .query({ code: "fake_code", state: stateToken });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/unauthorized organization binding/i);
  });

  it("returns 404 when organization does not exist", async () => {
    const fakeOrgId = new mongoose.Types.ObjectId();
    const owner = await User.create({
      name: "Fake Org Owner",
      email: `fakeorg-${Math.random()}@example.com`,
      password: "password123",
      role: "admin",
      organization: fakeOrgId, // Bind user to the fake org
    });

    const stateToken = createValidState(fakeOrgId, owner._id);

    const res = await request(app)
      .get("/api/slack/oauth_redirect")
      .query({ code: "fake_code", state: stateToken });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/organization not found/i);
  });

  it("saves Slack integration to org on successful OAuth", async () => {
    // Seed org and authorized owner
    const owner = await User.create({
      name: "OAuth Owner",
      email: `oauthowner-${Math.random()}@example.com`,
      password: "password123",
      role: "admin",
    });
    const org = await Organization.create({
      name: "OAuth Org",
      slug: "oauth-org-" + Math.random().toString(36).substring(7),
      owner: owner._id,
    });
    // Associate user with the org so they pass the binding check
    await User.findByIdAndUpdate(owner._id, { organization: org._id });

    const stateToken = createValidState(org._id, owner._id);

    const res = await request(app)
      .get("/api/slack/oauth_redirect")
      .query({ code: "valid_code", state: stateToken });

    // axios.post is mocked to return a successful Slack response
    // So this should redirect (302) to the frontend with ?slackInstall=success
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("slackInstall=success");

    // Verify the org was updated in the database
    const updatedOrg = await Organization.findById(org._id)
      .select("+slackIntegration.botToken")
      .lean();
    expect(updatedOrg.slackIntegration.teamId).toBe("T12345TEST");
    expect(updatedOrg.slackIntegration.teamName).toBe("Test Workspace");
    expect(updatedOrg.slackIntegration.channelId).toBe("C12345TEST");
    expect(updatedOrg.slackIntegration.botToken).toBe("xoxb-test-token");
    expect(updatedOrg.slackIntegration.installedAt).toBeTruthy();
  });
});
