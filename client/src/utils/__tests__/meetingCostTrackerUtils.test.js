import { describe, it, expect } from "vitest";
import {
  getHourlyRate,
  getDurationHours,
  getMonthlyFrequencyMultiplier,
  calculateSingleMeetingCost,
  calculateMonthlyMeetingCost,
  calculateMonthlyPersonHours,
  enrichMeetingCostData,
  calculateTeamMetrics,
  filterAndSortMeetings,
  generateCostRecommendations,
  DEFAULT_AVG_SALARY,
} from "../meetingCostTrackerUtils.js";

describe("Meeting Cost Tracker Utils (Issue #2613)", () => {
  const sampleMeetings = [
    {
      _id: "m1",
      title: "Sprint Planning",
      team: "Engineering",
      participantsCount: 6,
      durationMinutes: 60,
      frequency: "weekly",
      participants: [{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }],
    },
    {
      _id: "m2",
      title: "Daily Standup",
      team: "Engineering",
      participantsCount: 4,
      durationMinutes: 30,
      frequency: "daily",
      participants: [{ name: "Alice" }, { name: "Bob" }],
    },
    {
      _id: "m3",
      title: "Product Roadmap",
      team: "Product",
      participantsCount: 10,
      durationMinutes: 90,
      frequency: "monthly",
      participants: [{ name: "David" }, { name: "Eve" }],
    },
    {
      _id: "m4",
      title: "Design Critique",
      team: "Design",
      participantsCount: 5,
      durationMinutes: 45,
      frequency: "bi-weekly",
      participants: [{ name: "Fiona" }],
    },
  ];

  it("1. Verifies exact cost formula: avgSalary / 160 * participants * hours * frequency", () => {
    // $8000 / 160 = $50/hr
    // 5 participants * 2 hours * 4 (weekly) = 40 person-hours
    // 40 * $50 = $2000 / month
    const avgSalary = 8000;
    const participants = 5;
    const durationMinutes = 120; // 2 hours
    const frequency = "weekly"; // 4 times/month

    expect(getHourlyRate(avgSalary)).toBe(50);
    expect(
      calculateMonthlyPersonHours(participants, durationMinutes, frequency),
    ).toBe(40);

    const monthlyCost = calculateMonthlyMeetingCost(
      avgSalary,
      participants,
      durationMinutes,
      frequency,
    );

    expect(monthlyCost).toBe(2000);
  });

  it("2. Converts duration minutes correctly to hours", () => {
    expect(getDurationHours(60)).toBe(1);
    expect(getDurationHours(30)).toBe(0.5);
    expect(getDurationHours(90)).toBe(1.5);
    expect(getDurationHours(45)).toBe(0.75);
  });

  it("3. Handles frequency multipliers correctly", () => {
    expect(getMonthlyFrequencyMultiplier("daily")).toBe(20);
    expect(getMonthlyFrequencyMultiplier("weekly")).toBe(4);
    expect(getMonthlyFrequencyMultiplier("bi-weekly")).toBe(2);
    expect(getMonthlyFrequencyMultiplier("monthly")).toBe(1);
    expect(getMonthlyFrequencyMultiplier("one-time")).toBe(1);
  });

  it("4. Calculates single meeting instance cost accurately", () => {
    // $50/hr * 4 participants * 1 hour = $200
    const singleCost = calculateSingleMeetingCost(8000, 4, 60);
    expect(singleCost).toBe(200);
  });

  it("5. Calculates monthly meeting cost KPI correctly across dataset", () => {
    const enriched = sampleMeetings.map((m) =>
      enrichMeetingCostData(m, DEFAULT_AVG_SALARY),
    );
    const totalMonthlyCost = enriched.reduce(
      (sum, m) => sum + m.monthlyCost,
      0,
    );

    // m1: $50 * 6 * 1h * 4 = $1200
    // m2: $50 * 4 * 0.5h * 20 = $2000
    // m3: $50 * 10 * 1.5h * 1 = $750
    // m4: $50 * 5 * 0.75h * 2 = $375
    // Total = 1200 + 2000 + 750 + 375 = 4325
    expect(totalMonthlyCost).toBe(4325);
  });

  it("6. Calculates total person-hours KPI correctly", () => {
    const enriched = sampleMeetings.map((m) =>
      enrichMeetingCostData(m, DEFAULT_AVG_SALARY),
    );
    const totalPersonHours = enriched.reduce(
      (sum, m) => sum + m.personHours,
      0,
    );

    // m1: 6 * 1 * 4 = 24 hrs
    // m2: 4 * 0.5 * 20 = 40 hrs
    // m3: 10 * 1.5 * 1 = 15 hrs
    // m4: 5 * 0.75 * 2 = 7.5 hrs
    // Total = 24 + 40 + 15 + 7.5 = 86.5 hrs
    expect(totalPersonHours).toBe(86.5);
  });

  it("7. Calculates average cost per meeting correctly", () => {
    const enriched = sampleMeetings.map((m) =>
      enrichMeetingCostData(m, DEFAULT_AVG_SALARY),
    );
    const totalMonthlyCost = enriched.reduce(
      (sum, m) => sum + m.monthlyCost,
      0,
    );
    const avgCostPerMeeting = totalMonthlyCost / enriched.length;

    expect(avgCostPerMeeting).toBe(4325 / 4);
  });

  it("8. Filters meetings by team correctly", () => {
    const engOnly = filterAndSortMeetings(
      sampleMeetings,
      "Engineering",
      "cost",
      "desc",
    );
    expect(engOnly.length).toBe(2);
    expect(engOnly.every((m) => m.team === "Engineering")).toBe(true);
  });

  it("9. Sorts meetings by cost (descending & ascending)", () => {
    const desc = filterAndSortMeetings(sampleMeetings, "all", "cost", "desc");
    expect(desc[0].title).toBe("Daily Standup"); // $2000/mo
    expect(desc[desc.length - 1].title).toBe("Design Critique"); // $375/mo

    const asc = filterAndSortMeetings(sampleMeetings, "all", "cost", "asc");
    expect(asc[0].title).toBe("Design Critique");
    expect(asc[asc.length - 1].title).toBe("Daily Standup");
  });

  it("10. Sorts meetings by participants count", () => {
    const sorted = filterAndSortMeetings(
      sampleMeetings,
      "all",
      "participants",
      "desc",
    );
    expect(sorted[0].title).toBe("Product Roadmap"); // 10 participants
    expect(sorted[sorted.length - 1].participantsCount).toBe(4);
  });

  it("11. Sorts meetings by duration", () => {
    const sorted = filterAndSortMeetings(
      sampleMeetings,
      "all",
      "duration",
      "desc",
    );
    expect(sorted[0].title).toBe("Product Roadmap"); // 90 mins
    expect(sorted[sorted.length - 1].durationMinutes).toBe(30);
  });

  it("12. Sorts meetings by frequency", () => {
    const sorted = filterAndSortMeetings(
      sampleMeetings,
      "all",
      "frequency",
      "desc",
    );
    expect(sorted[0].title).toBe("Daily Standup"); // daily multiplier = 20
  });

  it("13. Computes team-based metrics and cost per member", () => {
    const metrics = calculateTeamMetrics(
      sampleMeetings,
      {},
      DEFAULT_AVG_SALARY,
    );
    const engTeam = metrics.find((t) => t.teamName === "Engineering");

    expect(engTeam).toBeDefined();
    expect(engTeam.meetingCount).toBe(2);
    expect(engTeam.totalMonthlyCost).toBe(3200); // 1200 + 2000
    expect(engTeam.totalPersonHours).toBe(64); // 24 + 40
    expect(engTeam.hourlyRate).toBe(50);
  });

  it("14. Calculates annual projected savings from recommendations", () => {
    const teamMetrics = calculateTeamMetrics(
      sampleMeetings,
      {},
      DEFAULT_AVG_SALARY,
    );
    const recs = generateCostRecommendations(
      sampleMeetings,
      teamMetrics,
      DEFAULT_AVG_SALARY,
    );
    expect(recs.length).toBeGreaterThan(0);

    recs.forEach((rec) => {
      expect(rec.annualSavings).toBe(rec.monthlySavings * 12);
    });
  });

  it("15. Assigns effort levels (Low, Medium, High) to recommendations", () => {
    const teamMetrics = calculateTeamMetrics(
      sampleMeetings,
      {},
      DEFAULT_AVG_SALARY,
    );
    const recs = generateCostRecommendations(
      sampleMeetings,
      teamMetrics,
      DEFAULT_AVG_SALARY,
    );
    const validEfforts = ["Low", "Medium", "High"];

    recs.forEach((rec) => {
      expect(validEfforts.includes(rec.effort)).toBe(true);
    });
  });
});
