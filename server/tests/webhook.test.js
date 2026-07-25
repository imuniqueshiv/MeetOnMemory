import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import axios from "axios";
import { jest } from "@jest/globals";
import { app } from "../server.js";
import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import Membership from "../models/membershipModel.js";
import Webhook from "../models/Webhook.js";
import WebhookDelivery from "../models/WebhookDelivery.js";
import eventBus from "../services/eventBus.js";

// Mock nodemailer to prevent SMTP verification during tests
jest.mock("../config/nodeMailer.js", () => ({
  sendMail: jest.fn(),
  __esModule: true,
  default: { sendMail: jest.fn() },
}));

// Import dispatcher to register eventBus listeners and access the queue
import * as dispatcher from "../services/webhookDispatcherService.js";

// Mock axios post to avoid hitting real endpoints
let axiosSpy;
let queueSpy;
beforeAll(() => {
  axiosSpy = jest
    .spyOn(axios, "post")
    .mockResolvedValue({ status: 200, data: {} });

  if (dispatcher.webhookQueue) {
    queueSpy = jest
      .spyOn(dispatcher.webhookQueue, "add")
      .mockImplementation(async (name, jobData) => {
        // Bypass Redis and execute synchronously
        await dispatcher.performDispatch(jobData.webhookId, jobData.payload);
      });
  }
});

afterAll(() => {
  axiosSpy.mockRestore();
  if (queueSpy) queueSpy.mockRestore();
});

describe("Webhook Endpoints & Dispatcher", () => {
  let user;
  let adminUser;
  let organization;
  let adminToken;
  let userToken;

  beforeEach(async () => {
    // Set up test organization
    organization = await Organization.create({
      name: "Test Org",
      slug: "test-org-" + Math.random().toString(36).substring(7),
      owner: new mongoose.Types.ObjectId(), // updated below
    });

    // Create normal user
    user = await User.create({
      name: "Normal User",
      email: `user-${Math.random()}@example.com`,
      password: "password123",
      organization: organization._id,
      role: "member",
    });
    userToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "fallback_secret",
    );

    // Create admin user (owner of organization)
    adminUser = await User.create({
      name: "Admin User",
      email: `admin-${Math.random()}@example.com`,
      password: "password123",
      organization: organization._id,
      role: "admin",
    });
    adminToken = jwt.sign(
      { id: adminUser._id },
      process.env.JWT_SECRET || "fallback_secret",
    );

    // Update organization owner to the adminUser
    organization.owner = adminUser._id;
    await organization.save();

    // Create active admin membership
    await Membership.create({
      user: adminUser._id,
      organization: organization._id,
      role: "admin",
      status: "active",
    });

    // Create active member membership for normal user
    await Membership.create({
      user: user._id,
      organization: organization._id,
      role: "member",
      status: "active",
    });
  });

  describe("POST /api/webhooks (Create)", () => {
    it("should allow organization admin to register webhook", async () => {
      const res = await request(app)
        .post("/api/webhooks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          targetUrl: "https://example.com/webhook",
          events: ["meeting.created", "mom.generated"],
          organizationId: organization._id.toString(),
          secret: "test_secret_key",
        });
      if (res.statusCode !== 201)
        console.log("CREATE WEBHOOK FAILED:", res.body);
      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.webhook.targetUrl).toBe("https://example.com/webhook");
      expect(res.body.webhook.secret).toBe("test_secret_key");
    });

    it("should reject webhook creation by non-admin member", async () => {
      const res = await request(app)
        .post("/api/webhooks")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          targetUrl: "https://example.com/webhook",
          events: ["meeting.created"],
          organizationId: organization._id.toString(),
        });

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });

    it("should validate targetUrl schema", async () => {
      const res = await request(app)
        .post("/api/webhooks")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          targetUrl: "ftp://invalid-url.com",
          events: ["meeting.created"],
          organizationId: organization._id.toString(),
        });
      if (res.statusCode !== 400) console.log("VALIDATE URL FAILED:", res.body);
      expect(res.statusCode).toEqual(400);
    });
  });

  describe("GET /api/webhooks (List)", () => {
    it("should list all webhooks for admin", async () => {
      await Webhook.create({
        organizationId: organization._id,
        targetUrl: "https://example.com/w1",
        events: ["meeting.created"],
        secret: "s1",
      });

      const res = await request(app)
        .get(`/api/webhooks?organizationId=${organization._id.toString()}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.webhooks.length).toBe(1);
    });
  });

  describe("PATCH /api/webhooks/:id (Update)", () => {
    it("should allow admin to update webhook settings", async () => {
      const hook = await Webhook.create({
        organizationId: organization._id,
        targetUrl: "https://example.com/old",
        events: ["meeting.created"],
        secret: "old_secret",
      });

      const res = await request(app)
        .patch(`/api/webhooks/${hook._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          targetUrl: "https://example.com/new",
          isActive: false,
        });
      if (res.statusCode !== 200)
        console.log("UPDATE WEBHOOK FAILED:", res.body);
      expect(res.statusCode).toEqual(200);
      expect(res.body.webhook.targetUrl).toBe("https://example.com/new");
      expect(res.body.webhook.isActive).toBe(false);
    });
  });

  describe("DELETE /api/webhooks/:id (Delete)", () => {
    it("should allow admin to delete webhook", async () => {
      const hook = await Webhook.create({
        organizationId: organization._id,
        targetUrl: "https://example.com/delete-me",
        events: ["meeting.created"],
        secret: "s",
      });

      const res = await request(app)
        .delete(`/api/webhooks/${hook._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(await Webhook.findById(hook._id)).toBeNull();
    });
  });

  describe("Event Bus Dispatching", () => {
    it("should fire webhook request when meeting.created event is emitted", async () => {
      const hook = await Webhook.create({
        organizationId: organization._id,
        targetUrl: "https://example.com/dispatch",
        events: ["meeting.created"],
        secret: "super_secret",
      });

      axiosSpy.mockClear();

      // Emit meeting.created event manually
      eventBus.emit("meeting.created", {
        _id: new mongoose.Types.ObjectId(),
        title: "Test Webhook Meeting",
        description: "Testing dispatcher",
        date: new Date(),
        meetingType: "internal",
        organization: organization._id,
      });

      // Wait deterministically for axiosSpy to have been called (up to 3000ms)
      let attempts = 0;
      while (axiosSpy.mock.calls.length === 0 && attempts < 300) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        attempts++;
      }

      expect(axiosSpy).toHaveBeenCalledTimes(1);
      const callArgs = axiosSpy.mock.calls[0];
      expect(callArgs[0]).toBe("https://example.com/dispatch");
      expect(callArgs[1].event).toBe("meeting.created");
      expect(callArgs[1].data.title).toBe("Test Webhook Meeting");
      expect(callArgs[2].headers["x-meetonmemory-signature"]).toBeDefined();
      expect(
        callArgs[2].headers["x-meetonmemory-request-timestamp"],
      ).toBeDefined();

      // Verify WebhookDelivery log record created
      const logs = await WebhookDelivery.find({ webhookId: hook._id });
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe("success");
      expect(logs[0].event).toBe("meeting.created");
    });
  });

  describe("GET /api/webhooks/:id/deliveries & Redelivery", () => {
    it("should retrieve delivery logs for admin", async () => {
      const hook = await Webhook.create({
        organizationId: organization._id,
        targetUrl: "https://example.com/logs",
        events: ["meeting.created"],
        secret: "s_log",
      });

      await WebhookDelivery.create({
        webhookId: hook._id,
        organizationId: organization._id,
        event: "meeting.created",
        payload: { event: "meeting.created", data: {} },
        responseStatus: 200,
        status: "success",
        attempt: 1,
      });

      const res = await request(app)
        .get(`/api/webhooks/${hook._id}/deliveries`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deliveries.length).toBe(1);
      expect(res.body.deliveries[0].status).toBe("success");
    });

    it("should allow admin to manually redeliver a payload", async () => {
      const hook = await Webhook.create({
        organizationId: organization._id,
        targetUrl: "https://example.com/retry",
        events: ["meeting.created"],
        secret: "s_retry",
      });

      const failedLog = await WebhookDelivery.create({
        webhookId: hook._id,
        organizationId: organization._id,
        event: "meeting.created",
        payload: {
          event: "meeting.created",
          data: { title: "Replay Meeting" },
        },
        responseStatus: 500,
        status: "failed",
        attempt: 1,
      });

      axiosSpy.mockClear();

      const res = await request(app)
        .post(`/api/webhooks/deliveries/${failedLog._id}/redeliver`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.delivery).toBeDefined();
      expect(axiosSpy).toHaveBeenCalledTimes(1);
    });

    it("should classify persistent failure as DLQ and update health status", async () => {
      const hook = await Webhook.create({
        organizationId: organization._id,
        targetUrl: "https://example.com/dead",
        events: ["meeting.created"],
        secret: "s_dead",
      });

      axiosSpy.mockImplementationOnce(() =>
        Promise.reject({
          response: { status: 500, data: { error: "Internal Error" } },
          message: "Request failed with status code 500",
        }),
      );

      try {
        await dispatcher.performDispatch(
          hook._id,
          { event: "meeting.created" },
          { attempt: 5, isFinalAttempt: true },
        );
      } catch (_err) {
        // Expected throw
      }

      const dlqLog = await WebhookDelivery.findOne({
        webhookId: hook._id,
        status: "dlq",
      });
      expect(dlqLog).not.toBeNull();
      expect(dlqLog.responseStatus).toBe(500);

      const updatedHook = await Webhook.findById(hook._id);
      expect(updatedHook.consecutiveFailures).toBe(1);
    });

    it("should auto-pause subscription when consecutive failures reach 15 (Circuit Breaker)", async () => {
      const hook = await Webhook.create({
        organizationId: organization._id,
        targetUrl: "https://example.com/circuit-break",
        events: ["meeting.created"],
        secret: "s_break",
        consecutiveFailures: 14,
        healthStatus: "degraded",
        isActive: true,
      });

      axiosSpy.mockImplementationOnce(() =>
        Promise.reject({
          response: { status: 503, data: { error: "Service Unavailable" } },
          message: "Request failed with status code 503",
        }),
      );

      try {
        await dispatcher.performDispatch(
          hook._id,
          { event: "meeting.created" },
          { attempt: 5, isFinalAttempt: true },
        );
      } catch (_err) {
        // Expected throw
      }

      const updatedHook = await Webhook.findById(hook._id);
      expect(updatedHook.consecutiveFailures).toBe(15);
      expect(updatedHook.healthStatus).toBe("paused");
      expect(updatedHook.isActive).toBe(false);
    });

    it("should reject non-admin users from viewing delivery logs or triggering redeliveries", async () => {
      const hook = await Webhook.create({
        organizationId: organization._id,
        targetUrl: "https://example.com/rbac",
        events: ["meeting.created"],
        secret: "s_rbac",
      });

      const delivery = await WebhookDelivery.create({
        webhookId: hook._id,
        organizationId: organization._id,
        event: "meeting.created",
        payload: { event: "meeting.created" },
        responseStatus: 200,
        status: "success",
        attempt: 1,
      });

      const logsRes = await request(app)
        .get(`/api/webhooks/${hook._id}/deliveries`)
        .set("Authorization", `Bearer ${userToken}`);
      expect(logsRes.statusCode).toBe(403);

      const redeliverRes = await request(app)
        .post(`/api/webhooks/deliveries/${delivery._id}/redeliver`)
        .set("Authorization", `Bearer ${userToken}`);
      expect(redeliverRes.statusCode).toBe(403);
    });
  });

  describe("HMAC Signature Utility", () => {
    it("should generate deterministic sha256 HMAC signature using timestamp", () => {
      const payload = { event: "meeting.created", id: "123" };
      const timestamp = "2026-07-20T20:00:00.000Z";
      const secret = "test_secret_123";

      const sig1 = dispatcher.generateSignature(payload, timestamp, secret);
      const sig2 = dispatcher.generateSignature(payload, timestamp, secret);

      expect(sig1).toBe(sig2);
      expect(typeof sig1).toBe("string");
      expect(sig1.length).toBe(64); // 64 hex characters for SHA-256
    });
  });
});
