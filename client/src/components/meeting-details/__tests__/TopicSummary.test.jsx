import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopicSummary from "../TopicSummary.jsx";
import { topicApi } from "../../../services/topicApi";
import { toast } from "react-toastify";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../services/topicApi", () => ({
  topicApi: {
    getTopicsForMeeting: vi.fn(),
    extractTopicsForMeeting: vi.fn(),
  },
}));

const SAMPLE_TOPICS = [
  {
    _id: "topic-1",
    name: "Budget Review",
    confidence: 90,
    timeRanges: [{ start: 65, end: 120 }],
  },
];

const renderPanel = (props = {}) =>
  render(
    <MemoryRouter>
      <TopicSummary meetingId="meeting-1" canExtract {...props} />
    </MemoryRouter>,
  );

describe("TopicSummary (#1996)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while topics are fetched", () => {
    topicApi.getTopicsForMeeting.mockImplementation(
      () => new Promise(() => {}),
    );

    renderPanel();

    expect(
      screen.getByLabelText(/loading meeting topics/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("topic-summary")).toHaveAttribute(
      "data-meeting-id",
      "meeting-1",
    );
    expect(topicApi.getTopicsForMeeting).toHaveBeenCalledWith("meeting-1");
  });

  it("shows an empty state with an extract CTA when no topics exist", async () => {
    topicApi.getTopicsForMeeting.mockResolvedValue({
      data: { success: true, data: [] },
    });

    renderPanel();

    expect(await screen.findByTestId("topic-summary-empty")).toHaveTextContent(
      /no topics extracted yet/i,
    );
    expect(
      screen.getByRole("button", { name: /extract topics/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open topic explorer/i }),
    ).toHaveAttribute("href", "/topics");
  });

  it("renders meeting topics when the API returns them", async () => {
    topicApi.getTopicsForMeeting.mockResolvedValue({
      data: { success: true, data: SAMPLE_TOPICS },
    });

    renderPanel();

    expect(await screen.findByText("Budget Review")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("1:05")).toBeInTheDocument();
  });

  it("extracts topics through topicApi.extractTopicsForMeeting and refreshes", async () => {
    topicApi.getTopicsForMeeting
      .mockResolvedValueOnce({ data: { success: true, data: [] } })
      .mockResolvedValueOnce({
        data: { success: true, data: SAMPLE_TOPICS },
      });
    topicApi.extractTopicsForMeeting.mockResolvedValue({
      data: { success: true, data: SAMPLE_TOPICS },
    });

    renderPanel();
    await screen.findByTestId("topic-summary-empty");

    fireEvent.click(screen.getByRole("button", { name: /extract topics/i }));

    await waitFor(() => {
      expect(topicApi.extractTopicsForMeeting).toHaveBeenCalledWith(
        "meeting-1",
      );
    });
    expect(await screen.findByText("Budget Review")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows an error state with retry when listing topics fails", async () => {
    topicApi.getTopicsForMeeting.mockRejectedValue({
      response: { data: { error: "Failed to load topics" } },
    });

    renderPanel();

    expect(await screen.findByTestId("topic-summary-error")).toHaveTextContent(
      /failed to load topics/i,
    );

    topicApi.getTopicsForMeeting.mockResolvedValue({
      data: { success: true, data: SAMPLE_TOPICS },
    });
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("Budget Review")).toBeInTheDocument();
  });

  it("hides the extract CTA for viewers", async () => {
    topicApi.getTopicsForMeeting.mockResolvedValue({
      data: { success: true, data: [] },
    });

    renderPanel({ canExtract: false });

    await screen.findByTestId("topic-summary-empty");
    expect(
      screen.queryByRole("button", { name: /extract topics/i }),
    ).not.toBeInTheDocument();
  });
});
