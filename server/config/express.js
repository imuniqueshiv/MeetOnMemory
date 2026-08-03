import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { corsOptions } from "./corsOptions.js";
import { configureHealthEndpoints } from "./health.js";
import { configureSecurity } from "./security.js";
import { csrfErrorHandler } from "../middleware/csrfProtection.js";
import { globalLimiter } from "../middleware/rateLimiter.js";
import errorHandler from "../middleware/errorHandler.js";
import requestContext from "../middleware/requestContext.js";

import webhookRoutes from "../routes/webhookRoutes.js";
import slackRoutes from "../routes/slackRoutes.js";
import { slackWebhookParser } from "../middleware/slackWebhookParser.js";
import publicSharedRoutes from "../routes/publicSharedRoutes.js";

export function configureExpress(app) {
  app.set("trust proxy", 1);

  // Correlation IDs must be available on every response, including health,
  // webhook, public, CSRF, and not-found responses.
  app.use(requestContext);
  configureSecurity(app);
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(cookieParser());

  // Dependency-aware health probes must not be blocked by the global limiter
  // or CSRF middleware.
  configureHealthEndpoints(app);

  // External/public routes use their own authentication mechanisms.
  app.use("/api/slack", slackWebhookParser, slackRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/public/shared", publicSharedRoutes);

  app.use(globalLimiter);
}

export function configureErrorHandling(app) {
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: "The requested resource was not found.",
      requestId: req.requestId,
    });
  });

  app.use(csrfErrorHandler);
  app.use(errorHandler);
}
