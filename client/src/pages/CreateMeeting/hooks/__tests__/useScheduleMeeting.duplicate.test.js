import { describe, expect, it } from "vitest";
import { buildDuplicateScheduleState } from "../useScheduleMeeting";

describe("buildDuplicateScheduleState", () => {
  it("prefills reusable fields but requires a new schedule", () => {
    const result = buildDuplicateScheduleState({
      title: "Planning (Copy)",
      description: "Quarterly plan",
      meetingType: "conference",
      date: "2026-08-01",
      time: "10:30",
      participants: [{ name: "A", email: "a@example.test" }],
      agendaItems: [{ text: "Review" }, { text: "Plan" }],
      tags: ["planning"],
    });

    expect(result.scheduleData.title).toBe("Planning (Copy)");
    expect(result.scheduleData.date).toBe("");
    expect(result.scheduleData.time).toBe("");
    expect(result.participants).toHaveLength(1);
    expect(result.agendaItems.map((item) => item.text)).toEqual([
      "Review",
      "Plan",
    ]);
    expect(result.metadata.tags).toEqual(["planning"]);
  });
});
