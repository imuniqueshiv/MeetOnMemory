import crypto from "crypto";
import mongoose from "mongoose";
import request from "supertest";
import { jest } from "@jest/globals";
import { app } from "../server.js";
import { createClerkTestToken } from "./helpers/clerkTestAuth.js";
import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import Membership from "../models/membershipModel.js";
import ActionItem from "../models/actionItemModel.js";
import Meeting from "../models/meetingModel.js";
import GithubIntegration from "../models/githubIntegrationModel.js";
import GitHubIssueSync from "../models/githubIssueSyncModel.js";
import { encryptToken } from "../utils/crypto.js";

// Mock nodemailer
jest.mock("../config/nodeMailer.js", () => ({
  sendMail: jest.fn(),
  __esModule: true,
  default: { sendMail: jest.fn() },
}));

// Mock Octokit to avoid real GitHub API calls
const mockIssueCreate = jest.fn();
jest.unstable_mockModule("@octokit/rest", () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: { issues: { create: mockIssueCreate } },
  })),
}));

const { syncActionItemToGitHub } =
  await import("../services/githubSyncService.js");

describe("GitHub Issue Sync — Issue #1600", () => {
  let orgA, orgB, user, userB, token, meeting, actionItem;

  beforeEach(async () => {
    orgA = await Organization.create({
      name: "Org A",
      slug: "org-a-" + Math.random().toString(36).slice(2),
      owner: new mongoose.Types.ObjectId(),
    });
    orgB = await Organization.create({
      name: "Org B",
      slug: "org-b-" + Math.random().toString(36).slice(2),
      owner: new mongoose.Types.ObjectId(),
    });

    user = await User.create({
      name: "Test User",
      email: `u-${Math.random()}@example.com`,
      password: "pass123",
      organization: orgA._id,
      role: "admin",
    });
    user.clerkUserId = `user_test_${user._id}`;
    await user.save();
    token = createClerkTestToken({
      clerkUserId: user.clerkUserId,
      email: user.email,
    });

    userB = await User.create({
      name: "Other User",
      email: `ub-${Math.random()}@example.com`,
      password: "pass123",
      organization: orgB._id,
      role: "admin",
    });

    orgA.owner = user._id;
    await orgA.save();

    await Membership.create({
      user: user._id,
      organization: orgA._id,
      role: "admin",
      status: "active",
    });

    meeting = await Meeting.create({
      title: "Sprint Retro",
      organizationId: orgA._id,
      createdBy: user._id,
      date: new Date(),
    });

    actionItem = await ActionItem.create({
      text: "Refactor auth middleware",
      sourceMeetingId: meeting._id,
      organization: orgA._id,
      status: "open",
    });

    await GithubIntegration.create({
      organization: orgA._id,
      accessToken: encryptToken("ghp_test_token"),
      repositoryFullName: "acme/project",
      connectedBy: user._id,
    });

    mockIssueCreate.mockReset();
    mockIssueCreate.mockResolvedValue({
      data: {
        number: 42,
        node_id: "I_abc123",
        html_url: "https://github.com/acme/project/issues/42",
      },
    });
  });

  // ─── Action Item → GitHub ────────────────────────────────────────────

  describe("syncActionItemToGitHub", () => {
    it("should create a GitHub issue and persist mapping", async () => {
      const result = await syncActionItemToGitHub(actionItem);

      expect(mockIssueCreate).toHaveBeenCalledTimes(1);
      expect(result.number).toBe(42);

      const mapping = await GitHubIssueSync.findOne({
        actionItem: actionItem._id,
      });
      expect(mapping).not.toBeNull();
      expect(mapping.githubIssueNumber).toBe(42);
      expect(mapping.repositoryFullName).toBe("acme/project");
      expect(mapping.organization.toString()).toBe(orgA._id.toString());

      const updated = await ActionItem.findById(actionItem._id);
      expect(updated.externalGitHubIssueId).toBe(42);
    });

    it("should NOT create a duplicate when synced twice", async () => {
      await syncActionItemToGitHub(actionItem);
      const secondResult = await syncActionItemToGitHub(actionItem);

      expect(mockIssueCreate).toHaveBeenCalledTimes(1);
      expect(secondResult.alreadySynced).toBe(true);
    });
  });

  // ─── GitHub → Action Item (Webhooks) ─────────────────────────────────

  describe("Webhook: issues.closed", () => {
    beforeEach(async () => {
      await syncActionItemToGitHub(actionItem);
    });

    it("should mark action item completed when GitHub issue is closed", async () => {
      const payload = {
        action: "closed",
        issue: { number: 42 },
        repository: { full_name: "acme/project" },
      };

      const res = await request(app)
        .post("/api/webhooks/github")
        .set("x-github-event", "issues")
        .set("x-github-delivery", "delivery-close-1")
        .send(payload);

      expect(res.statusCode).toBe(200);
      expect(res.body.updated).toBe(true);

      const item = await ActionItem.findById(actionItem._id);
      expect(item.status).toBe("completed");
      expect(item.resolvedAt).not.toBeNull();
    });
  });

  describe("Webhook: issues.reopened", () => {
    beforeEach(async () => {
      await syncActionItemToGitHub(actionItem);
      actionItem.status = "completed";
      actionItem.resolvedAt = new Date();
      await actionItem.save();
    });

    it("should reopen action item when GitHub issue is reopened", async () => {
      const res = await request(app)
        .post("/api/webhooks/github")
        .set("x-github-event", "issues")
        .set("x-github-delivery", "delivery-reopen-1")
        .send({
          action: "reopened",
          issue: { number: 42 },
          repository: { full_name: "acme/project" },
        });

      expect(res.statusCode).toBe(200);
      const item = await ActionItem.findById(actionItem._id);
      expect(item.status).toBe("open");
      expect(item.resolvedAt).toBeNull();
    });
  });

  // ─── Idempotency ─────────────────────────────────────────────────────

  describe("Duplicate webhook delivery", () => {
    beforeEach(async () => {
      await syncActionItemToGitHub(actionItem);
    });

    it("should skip duplicate delivery IDs", async () => {
      const payload = {
        action: "closed",
        issue: { number: 42 },
        repository: { full_name: "acme/project" },
      };

      await request(app)
        .post("/api/webhooks/github")
        .set("x-github-event", "issues")
        .set("x-github-delivery", "dup-delivery-1")
        .send(payload);

      // Reopen manually so we can tell if a second close went through
      const item = await ActionItem.findById(actionItem._id);
      item.status = "open";
      item.resolvedAt = null;
      await item.save();

      const res2 = await request(app)
        .post("/api/webhooks/github")
        .set("x-github-event", "issues")
        .set("x-github-delivery", "dup-delivery-1")
        .send(payload);

      expect(res2.body.message).toBe("Already processed");
      const afterSecond = await ActionItem.findById(actionItem._id);
      expect(afterSecond.status).toBe("open");
    });
  });

  // ─── Invalid Webhook Signature ────────────────────────────────────────

  describe("Webhook signature verification", () => {
    const originalSecret = process.env.GITHUB_WEBHOOK_SECRET;

    beforeEach(() => {
      process.env.GITHUB_WEBHOOK_SECRET = "test_secret";
    });

    afterEach(() => {
      if (originalSecret) {
        process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
      } else {
        delete process.env.GITHUB_WEBHOOK_SECRET;
      }
    });

    it("should reject requests with invalid signature", async () => {
      const res = await request(app)
        .post("/api/webhooks/github")
        .set("x-github-event", "issues")
        .set("x-github-delivery", "sig-test-1")
        .set("x-hub-signature-256", "sha256=invalid")
        .send({ action: "closed", issue: { number: 1 } });

      expect(res.statusCode).toBe(401);
    });

    it("should accept requests with valid signature", async () => {
      const body = { action: "ping" };
      const hmac = crypto.createHmac("sha256", "test_secret");
      const sig = "sha256=" + hmac.update(JSON.stringify(body)).digest("hex");

      const res = await request(app)
        .post("/api/webhooks/github")
        .set("x-github-event", "ping")
        .set("x-github-delivery", "sig-test-2")
        .set("x-hub-signature-256", sig)
        .send(body);

      expect(res.statusCode).toBe(200);
    });
  });

  // ─── Missing mapping ─────────────────────────────────────────────────

  describe("Webhook with no matching mapping", () => {
    it("should return 200 without updating anything", async () => {
      const res = await request(app)
        .post("/api/webhooks/github")
        .set("x-github-event", "issues")
        .set("x-github-delivery", "no-mapping-1")
        .send({
          action: "closed",
          issue: { number: 9999 },
          repository: { full_name: "unknown/repo" },
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.updated).toBe(false);
    });
  });

  // ─── Cross-org access prevention ──────────────────────────────────────

  describe("Cross-organization isolation", () => {
    it("should not allow syncing action items from another org", async () => {
      const otherMeeting = await Meeting.create({
        title: "Other Meeting",
        organizationId: orgB._id,
        createdBy: userB._id,
        date: new Date(),
      });

      const otherItem = await ActionItem.create({
        text: "Other org's task",
        sourceMeetingId: otherMeeting._id,
        organization: orgB._id,
        status: "open",
      });

      const res = await request(app)
        .post("/api/github/sync")
        .set("Authorization", `Bearer ${token}`)
        .send({ actionItemId: otherItem._id.toString() });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─── GitHub API failure handling ──────────────────────────────────────

  describe("GitHub API failure", () => {
    it("should propagate error without corrupting action item", async () => {
      mockIssueCreate.mockRejectedValueOnce(new Error("GitHub 502"));

      await expect(syncActionItemToGitHub(actionItem)).rejects.toThrow(
        "GitHub 502",
      );

      const item = await ActionItem.findById(actionItem._id);
      expect(item.externalGitHubIssueId).toBeNull();
      expect(item.status).toBe("open");
    });
  });

  // ─── Manual sync API ─────────────────────────────────────────────────

  describe("POST /api/github/sync", () => {
    it("should require actionItemId", async () => {
      const res = await request(app)
        .post("/api/github/sync")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it("should return 404 for non-existent action item", async () => {
      const res = await request(app)
        .post("/api/github/sync")
        .set("Authorization", `Bearer ${token}`)
        .send({ actionItemId: new mongoose.Types.ObjectId().toString() });

      expect(res.statusCode).toBe(404);
    });
  });
});
