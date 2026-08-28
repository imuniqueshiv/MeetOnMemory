import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Meeting insights routing (#2439)", () => {
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

  it("does not ship mock meeting insights data generators", () => {
    expect(existsSync(join(pagesDir, "meetingInsightsData.js"))).toBe(false);
  });

  it("routes MeetingInsightsDashboard for authorized users", () => {
    expect(protectedRoutesSource).toMatch(
      /import\("\.\.\/pages\/MeetingInsightsDashboard\.jsx"\)/,
    );
    expect(protectedRoutesSource).toMatch(
      /path="\/meeting-insights"[\s\S]*<MeetingInsightsDashboard \/>/,
    );
  });

  it("links navbar meeting insights to the canonical route", () => {
    expect(navbarSource).toMatch(
      /label: t\("navbar\.meetingInsights"\)[\s\S]*href: "\/meeting-insights"/,
    );
  });
});
