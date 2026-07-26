import express from "express";

export const slackWebhookParser = express.json({
  limit: "50mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
});
