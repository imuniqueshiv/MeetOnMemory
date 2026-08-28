// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppContent from "../../../../context/AppContent";
import { useScheduleMeeting } from "../useScheduleMeeting";
import { meetingApi } from "../../../../services";

vi.mock("../../../../services", () => ({
  meetingApi: {
    scheduleMeeting: vi.fn(),
  },
  meetingSeriesApi: {
    createSeries: vi.fn(),
  },
  meetingTemplateApi: {
    getTemplates: vi
      .fn()
      .mockResolvedValue({ data: { success: true, templates: [] } }),
  },
  aiSummaryTemplateApi: {
    getTemplates: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock("../../../../api/focusTimeApi", () => ({
  focusTimeApi: {
    getBlocks: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../api/customFieldApi", () => ({
  customFieldApi: {
    setMeetingFields: vi.fn(),
  },
}));

vi.mock("../../../../services/resourceBookingApi", () => ({
  default: {
    createBooking: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useScheduleMeeting tags persistence", () => {
  const mockUserData = {
    _id: "user-123",
    organization: { _id: "org-456" },
  };

  const wrapper = ({ children }) => (
    <AppContent.Provider value={{ userData: mockUserData }}>
      {children}
    </AppContent.Provider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists tags through schedule create payload to meeting metadata", async () => {
    meetingApi.scheduleMeeting.mockResolvedValue({
      data: { success: true, meeting: { _id: "m-100" } },
    });

    const { result } = renderHook(() => useScheduleMeeting(), { wrapper });

    act(() => {
      result.current.setScheduleData((prev) => ({
        ...prev,
        title: "Q4 Strategy Sync",
        date: "2026-10-15",
        time: "14:00",
        tags: ["strategy", "quarterly", "executive"],
      }));
    });

    await act(async () => {
      await result.current.handleScheduleSubmit({ preventDefault: vi.fn() });
    });

    expect(meetingApi.scheduleMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Q4 Strategy Sync",
        tags: ["strategy", "quarterly", "executive"],
        metadata: {
          tags: ["strategy", "quarterly", "executive"],
        },
      }),
    );
  });
});
