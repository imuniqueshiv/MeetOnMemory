import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppContent from "../../../../context/AppContent";
import { useScheduleMeeting } from "../useScheduleMeeting";
import { meetingApi } from "../../../../services";
import { attachmentApi } from "../../../../services/attachmentApi";

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

vi.mock("../../../../services/attachmentApi", () => ({
  attachmentApi: {
    uploadAttachment: vi.fn(),
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

describe("useScheduleMeeting create-time attachments (#1988)", () => {
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
    attachmentApi.uploadAttachment.mockResolvedValue({
      data: { success: true },
    });
  });

  it("uploads create-time files through attachmentApi after the meeting is scheduled", async () => {
    meetingApi.scheduleMeeting.mockResolvedValue({
      data: { success: true, meeting: { _id: "m-1" } },
    });

    const { result } = renderHook(() => useScheduleMeeting(), { wrapper });
    const file = new File(["notes"], "brief.pdf", { type: "application/pdf" });

    act(() => {
      result.current.setScheduleData((prev) => ({
        ...prev,
        title: "Planning",
        date: "2026-09-01",
        time: "10:00",
        recurrencePattern: "none",
      }));
      result.current.handleAttachmentUpload({ target: { files: [file] } });
    });

    await act(async () => {
      await result.current.handleScheduleSubmit({ preventDefault: vi.fn() });
    });

    expect(meetingApi.scheduleMeeting).toHaveBeenCalled();
    expect(attachmentApi.uploadAttachment).toHaveBeenCalledWith(
      "m-1",
      expect.any(FormData),
    );
  });
});
