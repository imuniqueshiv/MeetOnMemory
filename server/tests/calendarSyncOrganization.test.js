import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import CalendarConnection from "../models/calendarConnectionModel.js";
import Meeting from "../models/meetingModel.js";
import userModel from "../models/userModel.js";
import { triggerManualSync } from "../jobs/calendarSyncJob.js";
import * as calendarService from "../services/calendarService.js";

vi.mock("../services/calendarService.js", () => ({
  fetchExternalEvents: vi.fn(),
  decryptToken: vi.fn((t) => t),
  getGoogleOAuth2Client: vi.fn(),
  getMicrosoftClient: vi.fn(),
}));

describe("Calendar Synchronization Organization Association (#827)", () => {
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummyOrgId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("associates synchronized meetings with the user's organization", async () => {
    const mockUser = {
      _id: dummyUserId,
      organization: dummyOrgId,
    };

    const mockEvents = {
      google: [
        {
          id: "google_event_123",
          summary: "Team Sync Meeting",
          description: "Weekly sync meeting",
          start: { dateTime: "2026-08-01T10:00:00Z" },
          end: { dateTime: "2026-08-01T11:00:00Z" },
        },
      ],
    };

    vi.spyOn(CalendarConnection, "findOne").mockResolvedValue({
      user: dummyUserId,
      provider: "google",
      syncStatus: "connected",
      save: vi.fn().mockResolvedValue(true),
    });

    vi.spyOn(userModel, "findById").mockImplementation(() => ({
      select: vi.fn().mockResolvedValue(mockUser),
    }));

    calendarService.fetchExternalEvents.mockResolvedValue(mockEvents);

    vi.spyOn(Meeting, "findOne").mockResolvedValue(null);

    const createSpy = vi.spyOn(Meeting, "create").mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      uploadedBy: dummyUserId,
      organization: dummyOrgId,
      title: "Team Sync Meeting",
    });

    const result = await triggerManualSync(dummyUserId, "google");

    expect(result.syncedCount).toBe(1);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedBy: dummyUserId,
        organization: dummyOrgId,
        title: "Team Sync Meeting",
      }),
    );
  });

  it("updates unassociated existing meeting with the user's organization", async () => {
    const mockUser = {
      _id: dummyUserId,
      organization: dummyOrgId,
    };

    const mockEvents = {
      google: [
        {
          id: "google_event_456",
          summary: "Existing Event",
          description: "Description",
          start: { dateTime: "2026-08-01T10:00:00Z" },
          end: { dateTime: "2026-08-01T11:00:00Z" },
          updated: "2026-08-01T09:00:00Z",
        },
      ],
    };

    vi.spyOn(CalendarConnection, "findOne").mockResolvedValue({
      user: dummyUserId,
      provider: "google",
      syncStatus: "connected",
      save: vi.fn().mockResolvedValue(true),
    });

    vi.spyOn(userModel, "findById").mockImplementation(() => ({
      select: vi.fn().mockResolvedValue(mockUser),
    }));

    calendarService.fetchExternalEvents.mockResolvedValue(mockEvents);

    const existingMeetingInstance = {
      _id: new mongoose.Types.ObjectId(),
      uploadedBy: dummyUserId,
      organization: null,
      title: "Existing Event",
      calendarEvents: {
        google: {
          eventId: "google_event_456",
          syncedAt: new Date("2026-07-31T10:00:00Z"),
        },
      },
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(Meeting, "findOne").mockResolvedValue(existingMeetingInstance);

    const result = await triggerManualSync(dummyUserId, "google");

    expect(result.syncedCount).toBe(1);
    expect(existingMeetingInstance.organization).toEqual(dummyOrgId);
    expect(existingMeetingInstance.save).toHaveBeenCalled();
  });
});
