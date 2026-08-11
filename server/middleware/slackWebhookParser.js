import express from "express";

/**
 * Capture the original request bytes before body-parser mutates the stream.
 * Used by Slack signature verification (HMAC over the raw payload).
 */
const captureRawBody = (req, _res, buf) => {
  if (buf?.length) {
    req.rawBody = buf;
  }
};

/**
 * Strict payload cap for the public Slack webhook endpoints (Issue #1118).
 *
 * These routes are publicly reachable, so accepting up to 50mb is an
 * unnecessary resource-consumption and abuse vector. Slack event callbacks
 * and slash-command payloads are typically a few KB, so 1mb gives generous
 * headroom while rejecting oversized bodies early with a 413 (handled by the
 * global error handler's `entity.too.large` branch).
 */
export const SLACK_PAYLOAD_LIMIT = "1mb";

/**
 * Slack-specific body parsers.
 *
 * Must be mounted on `/api/slack` *before* the global `express.json` /
 * `express.urlencoded` middleware. Otherwise the global parsers consume the
 * stream first and `req.rawBody` is never set, breaking signature checks —
 * and the strict `SLACK_PAYLOAD_LIMIT` below is never enforced.
 *
 * Slack sends:
 * - `application/json` for Events API payloads
 * - `application/x-www-form-urlencoded` for slash commands
 */
export const slackWebhookParser = [
  express.json({
    limit: SLACK_PAYLOAD_LIMIT,
    verify: captureRawBody,
  }),
  express.urlencoded({
    extended: true,
    limit: SLACK_PAYLOAD_LIMIT,
    verify: captureRawBody,
  }),
];
