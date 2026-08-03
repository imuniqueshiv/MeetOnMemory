import { describe, it, expect } from "vitest";
import {
  buildFollowUpMeetingDraft,
  isFollowUpEligible,
} from "../followUpMeetingDraft";

describe("followUpMeetingDraft (#721)", () => {
  const tasks = [
    {
      id: "a1",
      title: "Ship docs",
      owner: "Alex",
      dueDate: "2026-08-01T00:00:00.000Z",
      meetingTitle: "Sprint Review",
      status: "open",
    },
    {
      id: "a2",
      title: "Fix login",
      owner: "Unassigned",
      meetingTitle: "Sprint Review",
      status: "in-progress",
    },
    {
      id: "a3",
      title: "Done item",
      status: "resolved",
      meetingTitle: "Sprint Review",
    },
  ];

  it("marks only open/in-progress items as eligible", () => {
    expect(isFollowUpEligible(tasks[0])).toBe(true);
    expect(isFollowUpEligible(tasks[1])).toBe(true);
    expect(isFollowUpEligible(tasks[2])).toBe(false);
  });

  it("builds a prefilled title, agenda, and source ids from eligible items", () => {
    const draft = buildFollowUpMeetingDraft(tasks);

    expect(draft.title).toBe("Follow-up: Sprint Review");
    expect(draft.sourceActionItemIds).toEqual(["a1", "a2"]);
    expect(draft.agendaItems).toHaveLength(2);
    expect(draft.agendaItems[0].text).toBe("Ship docs");
    expect(draft.agendaItems[0].description).toContain("Owner: Alex");
    expect(draft.agendaItems[0].description).toContain("From: Sprint Review");
    expect(draft.description).toMatch(/2 selected action item/);
  });

  it("uses a multi-meeting title when sources differ", () => {
    const draft = buildFollowUpMeetingDraft([
      { ...tasks[0], meetingTitle: "Alpha" },
      { ...tasks[1], meetingTitle: "Beta" },
    ]);
    expect(draft.title).toBe("Follow-up: 2 meetings");
  });
});
