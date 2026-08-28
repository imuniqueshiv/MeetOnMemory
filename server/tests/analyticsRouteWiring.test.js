/**
 * Issue #1532 — Analytics route wiring: one canonical /api/analytics mount,
 * orphaned analytics.routes.js must stay gone, migrated team endpoints live
 * on analyticsRoutes.js with userAuth + org-scoped queries.
 */

import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

vi.mock("openai", () => ({
  default: class OpenAI {},
}));

import routes from "../routes/index.js";
import analyticsRoutes from "../routes/analyticsRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function countMatchingLayers(router, pathStr) {
  const stack = router.stack || [];
  return stack.filter(
    (layer) => typeof layer.match === "function" && layer.match(pathStr),
  ).length;
}

describe("Analytics route wiring (#1532)", () => {
  it("mounts /api/analytics exactly once on the central router", () => {
    expect(countMatchingLayers(routes, "/api/analytics")).toBe(1);
  });

  it("does not leave an orphaned analytics.routes.js module on disk", () => {
    const orphanPath = path.resolve(__dirname, "../routes/analytics.routes.js");
    expect(fs.existsSync(orphanPath)).toBe(false);
  });

  it("does not import analytics.routes.js from the central router", () => {
    const indexSource = fs.readFileSync(
      path.resolve(__dirname, "../routes/index.js"),
      "utf8",
    );
    expect(indexSource).not.toMatch(/analytics\.routes/);
    expect(indexSource).toMatch(/from ["']\.\/analyticsRoutes\.js["']/);
  });

  it("exposes canonical and migrated analytics endpoints on analyticsRoutes", () => {
    const routeLayers = (analyticsRoutes.stack || []).filter(
      (layer) => layer.route,
    );
    const paths = routeLayers.map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

    expect(paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/",
          methods: expect.arrayContaining(["get"]),
        }),
        expect.objectContaining({
          path: "/meetings/:meetingId",
          methods: expect.arrayContaining(["get"]),
        }),
        expect.objectContaining({
          path: "/meeting/:meetingId",
          methods: expect.arrayContaining(["get"]),
        }),
        expect.objectContaining({
          path: "/analyze/:meetingId",
          methods: expect.arrayContaining(["post"]),
        }),
        expect.objectContaining({
          path: "/team/:teamId/summary",
          methods: expect.arrayContaining(["get"]),
        }),
        expect.objectContaining({
          path: "/team/:teamId/recent",
          methods: expect.arrayContaining(["get"]),
        }),
        expect.objectContaining({
          path: "/org-timeline",
          methods: expect.arrayContaining(["get"]),
        }),
      ]),
    );
  });

  it("applies userAuth before analytics handlers (no obsolete authMiddleware)", () => {
    const routesSource = fs.readFileSync(
      path.resolve(__dirname, "../routes/analyticsRoutes.js"),
      "utf8",
    );
    expect(routesSource).toMatch(/userAuth/);
    expect(routesSource).not.toMatch(/authMiddleware/);
    expect(routesSource).not.toMatch(/\bprotect\b/);

    const controllerSource = fs.readFileSync(
      path.resolve(__dirname, "../controllers/meetingAnalyticsController.js"),
      "utf8",
    );
    expect(controllerSource).toMatch(/meetingModel\.js/);
    expect(controllerSource).not.toMatch(/models\/Meeting\.js/);
    expect(controllerSource).not.toMatch(/models\/ActionItem\.js/);
  });
});
