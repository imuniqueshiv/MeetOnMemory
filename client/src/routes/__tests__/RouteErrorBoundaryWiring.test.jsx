import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Ensures primary protected shells stay wrapped for #2248.
 * Source assertion avoids mounting the full ProtectedRoutes tree.
 */
describe("ProtectedRoutes RouteErrorBoundary wiring (#2248)", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../ProtectedRoutes.jsx"),
    "utf8",
  );

  it("imports RouteErrorBoundary", () => {
    expect(source).toMatch(/import RouteErrorBoundary from/);
  });

  it.each([
    ["Dashboard", "/dashboard"],
    ["Meeting Details", "/meeting/:id"],
    ["Meeting Room", "/meeting-room/:roomId"],
    ["Admin", "/admin-panel"],
    ["Org Settings", "/organization/settings"],
  ])("wraps %s shell (%s)", (section) => {
    expect(source).toContain(`section="${section}"`);
  });
});
