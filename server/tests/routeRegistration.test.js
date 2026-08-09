import { vi, describe, it, expect } from "vitest";

vi.mock("openai", () => ({
  default: class OpenAI {},
}));

import express from "express";
import routes from "../routes/index.js";

function countMatchingLayers(router, pathStr) {
  const stack = router.stack || [];
  return stack.filter(
    (layer) => typeof layer.match === "function" && layer.match(pathStr),
  ).length;
}

describe("Route Consolidation and Registration", () => {
  it("should export a valid Express router stack with mounted routes", () => {
    expect(routes).toBeDefined();
    expect(typeof routes).toBe("function");

    const stack = routes.stack || [];
    expect(stack.length).toBeGreaterThan(0);
  });

  it("should ensure no duplicate route registrations exist for API route prefixes", () => {
    const standaloneRoutePrefixes = [
      "/api/auth",
      "/api/calendar",
      "/api/assistant",
      "/api/user",
      "/api/notifications",
      "/api/knowledge",
      "/api/compliance",
      "/api/sessions",
      "/api/transcripts",
      "/api/search",
      "/api/ai",
      "/api/policies",
      "/api/analytics",
      "/api/gemini",
      "/api/invitation",
      "/api/membership-request",
      "/api/shared-links",
      "/api/templates",
      "/api/bookmarks",
      "/api/comments",
      "/api/activities",
      "/api/tags",
      "/api/polls",
      "/api/meeting-series",
      "/api/comparison",
      "/api/dashboard",
      "/api/digest-preferences",
      "/api/decision-graph",
      "/api/attendance-analytics",
      "/api/feedback",
      "/api/meeting-cost",
      "/api/follow-up-threads",
      "/api/recap-schedule",
      "/api/clips",
      "/api/speaker-mappings",
      "/api/note-versions",
      "/api/reports",
      "/api/agenda-suggestions",
      "/api/translations",
      "/api/personal-notes",
      "/api/template-library",
      "/api/transcript-annotations",
      "/api/glossary",
      "/api/ai-summary-templates",
      "/api/topics",
    ];

    for (const prefix of standaloneRoutePrefixes) {
      const matchCount = countMatchingLayers(routes, prefix);
      expect(matchCount).toBe(1);
    }
  });

  it("should verify backward compatibility: all expected API routes are mounted", () => {
    const expectedRoutes = [
      "/api/auth",
      "/api/organization",
      "/api/organizations",
      "/api/membership",
      "/api/memberships",
      "/api/membership-request",
      "/api/membership-requests",
      "/api/invitation",
      "/api/invitations",
      "/api/meetings/timer",
      "/api/meetings",
      "/api/search",
      "/api/ai",
      "/api/policies",
      "/api/analytics",
      "/api/gemini",
      "/api/user",
      "/api/users",
      "/api/notification",
      "/api/notifications",
      "/api/knowledge",
      "/api/calendar",
      "/api/compliance",
      "/api/sessions",
      "/api/assistant",
      "/api/transcripts",
      "/api/shared-links",
      "/api/templates",
      "/api/bookmarks",
      "/api/comments",
      "/api/activities",
      "/api/tags",
      "/api/polls",
      "/api/meeting-series",
      "/api/comparison",
      "/api/dashboard",
      "/api/digest-preferences",
      "/api/decision-graph",
      "/api/attendance-analytics",
      "/api/feedback",
      "/api/meeting-cost",
      "/api/follow-up-threads",
      "/api/recap-schedule",
      "/api/clips",
      "/api/speaker-mappings",
      "/api/note-versions",
      "/api/reports",
      "/api/agenda-suggestions",
      "/api/translations",
      "/api/personal-notes",
      "/api/template-library",
      "/api/transcript-annotations",
      "/api/glossary",
      "/api/ai-summary-templates",
      "/api/topics",
      "/api/automation-rules",
      "/api/meeting-health",
      "/api/workspace",
      "/api/recap",
    ];

    for (const routePath of expectedRoutes) {
      const matchCount = countMatchingLayers(routes, routePath);
      expect(matchCount).toBeGreaterThan(0);
    }
  });

  it("regression: should detect and fail when duplicate route prefixes are registered", () => {
    const dummyRouter = express.Router();
    const mockHandler = (req, res, next) => next();

    dummyRouter.use("/api/test-route", mockHandler);
    expect(countMatchingLayers(dummyRouter, "/api/test-route")).toBe(1);

    // Intentionally register the duplicate route prefix
    dummyRouter.use("/api/test-route", mockHandler);
    expect(countMatchingLayers(dummyRouter, "/api/test-route")).toBe(2);
  });
});
