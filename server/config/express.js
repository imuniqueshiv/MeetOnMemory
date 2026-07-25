import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { corsOptions } from "./corsOptions.js";
import {
  csrfProtectionMiddleware,
  csrfTokenProvider, // eslint-disable-line no-unused-vars
  csrfErrorHandler,
} from "../middleware/csrfProtection.js";
import { globalLimiter } from "../middleware/rateLimiter.js";
import errorHandler from "../middleware/errorHandler.js";

// Import webhook routes that bypass CSRF
import webhookRoutes from "../routes/webhookRoutes.js";
import slackRoutes from "../routes/slackRoutes.js";
import { slackWebhookParser } from "../middleware/slackWebhookParser.js";
import publicSharedRoutes from "../routes/publicSharedRoutes.js";

export function configureExpress(app) {
  // Trust proxy for Render/Vercel
  app.set("trust proxy", 1);

  // MIDDLEWARES
  app.use(cors(corsOptions));

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // ==========================================
  // 1. BYPASSED ROUTES (No CSRF Protection)
  //    External services authenticate via their own mechanisms.
  // ==========================================
  app.use("/api/slack", slackWebhookParser, slackRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/public/shared", publicSharedRoutes);

  // ==========================================
  // 2. COOKIES & CSRF (Global for all remaining routes)
  // ==========================================
  app.use(cookieParser());
  app.use(csrfProtectionMiddleware);

  // CSRF token provider
  app.get("/api/csrf-token", (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  // Health check endpoint — registered BEFORE the global rate limiter so
  // keep-alive pings (e.g. from GitHub Actions cron job) are never blocked.
  app.get(["/health", "/api/health"], (req, res) => {
    res.status(200).json({
      status: "UP",
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
    });
  });

  // GLOBAL RATE LIMITER
  app.use(globalLimiter);
}

export function configureErrorHandling(app) {
  // CSRF ERROR HANDLER
  app.use(csrfErrorHandler);
  // ERROR HANDLER
  app.use(errorHandler);
}
