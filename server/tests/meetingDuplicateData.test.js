import { describe, expect, test } from "@jest/globals";
import { buildDuplicateMeetingData } from "../services/MeetingService.js";

describe("buildDuplicateMeetingData", () => {
  test("copies reusable fields and strips generated data", () => {
    const source = {
      _id: "507f1f77bcf86cd799439011",
      title: "Weekly Sync",
      description: "Team updates",
      organization: "507f191e810c19729de860ea",
      meetingType: "internal",
      date: new Date("2026-08-01T09:00:00Z"),
      time: "09:00",
      duration: 45,
      location: "Zoom",
      venue: "https://example.test/room",
      participants: [
        { _id: "p1", name: "A", email: "a@example.test", role: "Lead" },
      ],
      agendaItems: [
        {
          _id: "a1",
          text: "Updates",
          description: "Round table",
          duration: 10,
        },
        { _id: "a2", text: "Blockers", description: "", duration: 15 },
      ],
      tags: ["weekly"],
      transcript: "must not copy",
      summary: "must not copy",
      status: "completed",
      googleEventId: "event-id",
      calendarEvents: { google: { eventId: "event-id" } },
    };

    const result = buildDuplicateMeetingData(source);

    expect(result).toEqual(
      expect.objectContaining({
        sourceMeetingId: source._id,
        title: "Weekly Sync (Copy)",
        description: "Team updates",
        organization: source.organization,
        meetingType: "internal",
        date: "",
        time: "",
        duration: 45,
        location: "Zoom",
        venue: "https://example.test/room",
        tags: ["weekly"],
      }),
    );
    expect(result.participants).toEqual([
      { name: "A", email: "a@example.test", role: "Lead" },
    ]);
    expect(result.agendaItems.map((item) => item.text)).toEqual([
      "Updates",
      "Blockers",
    ]);
    expect(result).not.toHaveProperty("transcript");
    expect(result).not.toHaveProperty("summary");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("calendarEvents");
    expect(result).not.toHaveProperty("googleEventId");
  });
});
