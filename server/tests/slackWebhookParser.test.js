/**
 * slackWebhookParser.test.js
 *
 * Isolated tests for Issue #614 raw-body capture.
 * Intentionally does NOT import server.js or slackService.js — those pull a large
 * ESM graph that triggers Jest's "module is already linked" / post-teardown
 * import errors when this file runs alongside other suites.
 */

import request from "supertest";
import crypto from "crypto";
import express from "express";
import {
  slackWebhookParser,
  SLACK_PAYLOAD_LIMIT,
} from "../middleware/slackWebhookParser.js";
import errorHandler from "../middleware/errorHandler.js";

const SIGNING_SECRET = "test_signing_secret_parser";

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

const verifyAgainstRawBody = (req) => {
  const slackSignature = req.headers["x-slack-signature"];
  const slackTimestamp = req.headers["x-slack-request-timestamp"];
  if (!slackSignature || !slackTimestamp || !req.rawBody) {
    return false;
  }
  const rawBody = req.rawBody.toString("utf8");
  const computed =
    "v0=" +
    crypto
      .createHmac("sha256", SIGNING_SECRET)
      .update(`v0:${slackTimestamp}:${rawBody}`, "utf8")
      .digest("hex");
  return computed === slackSignature;
};

describe("slackWebhookParser raw body capture (Issue #614)", () => {
  const buildSlackOnlyApp = () => {
    const slackApp = express();
    // Correct order: Slack parsers first (no prior global JSON parser).
    slackApp.use("/api/slack", slackWebhookParser, (req, res) => {
      res.status(200).json({
        hasRawBody: Boolean(req.rawBody),
        rawBody: req.rawBody ? req.rawBody.toString("utf8") : null,
        parsedBody: req.body,
        signatureValid: verifyAgainstRawBody(req),
      });
    });
    return slackApp;
  };

  it("captures raw JSON body and verifies Slack signature against it", async () => {
    const payload = { type: "url_verification", challenge: "challenge-token" };
    const raw = JSON.stringify(payload);
    const { signature, timestamp } = generateSlackSignature(raw);

    const res = await request(buildSlackOnlyApp())
      .post("/api/slack/events")
      .set("Content-Type", "application/json")
      .set("x-slack-signature", signature)
      .set("x-slack-request-timestamp", timestamp)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.hasRawBody).toBe(true);
    expect(res.body.signatureValid).toBe(true);
    expect(res.body.rawBody).toBe(raw);
    expect(res.body.parsedBody).toEqual(payload);
  });

  it("captures raw urlencoded body for slash commands and verifies signature", async () => {
    const raw = new URLSearchParams({
      command: "/mom-create",
      text: '"Planning"',
      team_id: "T123",
    }).toString();
    const { signature, timestamp } = generateSlackSignature(raw);

    const res = await request(buildSlackOnlyApp())
      .post("/api/slack/events")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .set("x-slack-signature", signature)
      .set("x-slack-request-timestamp", timestamp)
      .send(raw);

    expect(res.status).toBe(200);
    expect(res.body.hasRawBody).toBe(true);
    expect(res.body.signatureValid).toBe(true);
    expect(res.body.rawBody).toBe(raw);
    expect(res.body.parsedBody.command).toBe("/mom-create");
  });

  it("does not capture rawBody when a prior global JSON parser consumes the stream", async () => {
    const brokenApp = express();
    // Incorrect order (the pre-fix bug): global JSON first, then Slack parser.
    brokenApp.use(express.json({ limit: "50mb" }));
    brokenApp.use("/api/slack", slackWebhookParser, (req, res) => {
      res.status(200).json({
        hasRawBody: Boolean(req.rawBody),
        parsedType: req.body?.type,
      });
    });

    const payload = { type: "url_verification", challenge: "x" };
    const res = await request(brokenApp)
      .post("/api/slack/events")
      .set("Content-Type", "application/json")
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.parsedType).toBe("url_verification");
    expect(res.body.hasRawBody).toBe(false);
  });
});

describe("slackWebhookParser payload limit (Issue #1118)", () => {
  const buildLimitedApp = () => {
    const limitedApp = express();
    // Match the production mount order (config/express.js): Slack parser first,
    // then the global error handler to serialize body-parser errors.
    limitedApp.use("/api/slack", slackWebhookParser, (req, res) => {
      res.status(200).json({ ok: true });
    });
    limitedApp.use(errorHandler);
    return limitedApp;
  };

  it("defines a strict Slack payload limit (not the legacy 50mb)", () => {
    expect(SLACK_PAYLOAD_LIMIT).toBe("1mb");
  });

  it("rejects an oversized JSON event payload with 413", async () => {
    const bigString = "x".repeat(1024 * 1024 + 1024); // ~1MB+ — over the limit
    const res = await request(buildLimitedApp())
      .post("/api/slack/events")
      .set("Content-Type", "application/json")
      .send({ type: "event_callback", blob: bigString });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
  });

  it("rejects an oversized urlencoded slash-command payload with 413", async () => {
    const bigText = "y".repeat(1024 * 1024 + 1024); // ~1MB+ — over the limit
    const res = await request(buildLimitedApp())
      .post("/api/slack/events")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send(`command=/mom-create&text=${encodeURIComponent(bigText)}`);

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
  });

  it("still accepts a legitimate Slack payload under the limit", async () => {
    const payload = { type: "url_verification", challenge: "challenge-token" };
    const res = await request(buildLimitedApp())
      .post("/api/slack/events")
      .set("Content-Type", "application/json")
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
