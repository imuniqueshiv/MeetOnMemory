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
 * Slack-specific body parsers.
 *
 * Must be mounted on `/api/slack` *before* the global `express.json` /
 * `express.urlencoded` middleware. Otherwise the global parsers consume the
 * stream first and `req.rawBody` is never set, breaking signature checks.
 *
 * Slack sends:
 * - `application/json` for Events API payloads
 * - `application/x-www-form-urlencoded` for slash commands
 */
export const slackWebhookParser = [
  express.json({
    limit: "50mb",
    verify: captureRawBody,
  }),
  express.urlencoded({
    extended: true,
    limit: "50mb",
    verify: captureRawBody,
  }),
];
