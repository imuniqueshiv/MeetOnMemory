import { describe, test, expect } from "vitest";
import { createMeetingSchema } from "../middleware/meetingValidation.js";

describe("createMeetingSchema", () => {
  const validMeeting = {
    title: "Weekly engineering sync",
    description: "Sprint planning",
    meetingType: "conference",
    date: "2026-08-20T10:00:00.000Z",
    time: "10:00",
    duration: 60,
    location: "Online",
    venue: "https://example.test/meeting",
    participants: [
      {
        name: "Test User",
        email: "test@example.com",
        role: "member",
      },
    ],
    agendaItems: [
      {
        text: "Review blockers",
        description: "Discuss current blockers",
        duration: 15,
      },
    ],
    recordingType: "live",
    syncToCalendar: false,
  };

  test("accepts valid meeting data", () => {
    expect(createMeetingSchema.safeParse(validMeeting).success).toBe(true);
  });

  test("rejects an empty title", () => {
    expect(
      createMeetingSchema.safeParse({ ...validMeeting, title: "   " }).success,
    ).toBe(false);
  });

  test("rejects oversized text fields", () => {
    expect(
      createMeetingSchema.safeParse({
        ...validMeeting,
        description: "x".repeat(5001),
      }).success,
    ).toBe(false);
  });

  test("rejects invalid dates and times", () => {
    expect(
      createMeetingSchema.safeParse({
        ...validMeeting,
        date: "not-a-date",
      }).success,
    ).toBe(false);

    expect(
      createMeetingSchema.safeParse({
        ...validMeeting,
        time: "25:99",
      }).success,
    ).toBe(false);
  });

  test("rejects invalid durations", () => {
    expect(
      createMeetingSchema.safeParse({ ...validMeeting, duration: -1 }).success,
    ).toBe(false);

    expect(
      createMeetingSchema.safeParse({ ...validMeeting, duration: 1441 })
        .success,
    ).toBe(false);
  });

  test("rejects unknown keys that could carry Mongo operators", () => {
    expect(
      createMeetingSchema.safeParse({
        ...validMeeting,
        $where: "malicious",
      }).success,
    ).toBe(false);

    expect(
      createMeetingSchema.safeParse({
        ...validMeeting,
        participants: [{ ...validMeeting.participants[0], $gt: "malicious" }],
      }).success,
    ).toBe(false);
  });

  test("rejects oversized participant and agenda collections", () => {
    expect(
      createMeetingSchema.safeParse({
        ...validMeeting,
        participants: Array.from({ length: 501 }, () => ({
          name: "User",
          email: "user@example.com",
        })),
      }).success,
    ).toBe(false);

    expect(
      createMeetingSchema.safeParse({
        ...validMeeting,
        agendaItems: Array.from({ length: 201 }, () => ({ text: "Agenda" })),
      }).success,
    ).toBe(false);
  });

  test("accepts valid venue coordinates and persists them (#2256)", () => {
    const withCoords = {
      ...validMeeting,
      venue: "1600 Amphitheatre Pkwy, Mountain View, CA",
      venueCoordinates: {
        lat: 37.422,
        lng: -122.084,
      },
    };
    const parsed = createMeetingSchema.safeParse(withCoords);
    expect(parsed.success).toBe(true);
    expect(parsed.data.venueCoordinates).toEqual({
      lat: 37.422,
      lng: -122.084,
    });
  });

  test("handles null or missing venue coordinates gracefully (#2256)", () => {
    const withNullCoords = {
      ...validMeeting,
      venueCoordinates: null,
    };
    expect(createMeetingSchema.safeParse(withNullCoords).success).toBe(true);
  });
});
