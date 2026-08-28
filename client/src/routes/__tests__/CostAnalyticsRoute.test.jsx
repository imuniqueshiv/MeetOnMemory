import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Ensures a single canonical cost analytics page ships (#2442).
 */
describe("Cost analytics routing (#2442)", () => {
  const routesDir = dirname(fileURLToPath(import.meta.url));
  const pagesDir = join(routesDir, "../../pages");
  const protectedRoutesSource = readFileSync(
    join(routesDir, "../ProtectedRoutes.jsx"),
    "utf8",
  );
  const navbarSource = readFileSync(
    join(routesDir, "../../components/Navbar.jsx"),
    "utf8",
  );

  const orphanMockFiles = [
    "CostAnalyticsDashboard.jsx",
    "costAnalyticsData.js",
    "CostAnalyticsCards.jsx",
    "CostAnalyticsCharts.jsx",
    "costAnalyticsTypes.js",
  ];

  it("does not ship orphan mock cost dashboard files", () => {
    for (const file of orphanMockFiles) {
      expect(existsSync(join(pagesDir, file))).toBe(false);
    }
  });

  it("routes MeetingCostAnalytics as the canonical cost page", () => {
    expect(protectedRoutesSource).toMatch(
      /import\("\.\.\/pages\/MeetingCostAnalytics\.jsx"\)/,
    );
    expect(protectedRoutesSource).not.toMatch(/CostAnalyticsDashboard/);
    expect(protectedRoutesSource).toMatch(
      /path="\/meeting-cost-analytics"[\s\S]*<MeetingCostAnalytics \/>/,
    );
  });

  it("links navbar cost analytics to the canonical route", () => {
    expect(navbarSource).toMatch(
      /label: t\("navbar\.costAnalytics"\)[\s\S]*href: "\/meeting-cost-analytics"/,
    );
  });
});
