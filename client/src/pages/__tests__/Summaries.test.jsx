import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Summaries from "../Summaries";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

vi.mock("../../hooks/useExport.js", () => ({
  default: () => ({
    exportMeeting: vi.fn(),
    isExporting: false,
  }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const getAllMeetings = vi.fn();
const deleteMeeting = vi.fn();

vi.mock("../../services", () => ({
  meetingApi: {
    getAllMeetings: (...args) => getAllMeetings(...args),
    deleteMeeting: (...args) => deleteMeeting(...args),
  },
}));

const meetingPage = (page, total = 20) => ({
  data: {
    success: true,
    meetings: Array.from({ length: 9 }, (_, i) => ({
      _id: `m-${page}-${i}`,
      title: `Meeting ${page}-${i}`,
      summary: `Summary for page ${page} item ${i}`,
      createdAt: new Date("2024-01-15T10:00:00Z").toISOString(),
    })),
    pagination: {
      total,
      page,
      limit: 9,
      totalPages: Math.ceil(total / 9),
    },
  },
});

describe("Summaries page server-side loading (#909)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllMeetings.mockImplementation(({ page = 1 } = {}) =>
      Promise.resolve(meetingPage(page)),
    );
  });

  it("loads the first page from the API with pagination params", async () => {
    render(
      <MemoryRouter>
        <Summaries />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getAllMeetings).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 9,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
      );
    });

    expect(await screen.findAllByTestId("summary-card")).toHaveLength(9);
    expect(screen.getByText("Meeting 1-0")).toBeInTheDocument();
  });

  it("requests the next page from the server when pagination is used", async () => {
    render(
      <MemoryRouter>
        <Summaries />
      </MemoryRouter>,
    );

    await screen.findByText("Meeting 1-0");

    const page2 = await screen.findByRole("button", { name: "2" });
    fireEvent.click(page2);

    await waitFor(() => {
      expect(getAllMeetings).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 9 }),
      );
    });

    expect(await screen.findByText("Meeting 2-0")).toBeInTheDocument();
  });

  it("sends search to the backend instead of filtering only in memory", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(
      <MemoryRouter>
        <Summaries />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getAllMeetings).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("summaries.searchPlaceholder");
    fireEvent.change(input, { target: { value: "quarterly" } });

    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(getAllMeetings).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          search: "quarterly",
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
      );
    });

    vi.useRealTimers();
  });

  it("reuses cached page results without an extra network request", async () => {
    render(
      <MemoryRouter>
        <Summaries />
      </MemoryRouter>,
    );

    await screen.findByText("Meeting 1-0");

    fireEvent.click(await screen.findByRole("button", { name: "2" }));
    await screen.findByText("Meeting 2-0");

    getAllMeetings.mockClear();

    fireEvent.click(await screen.findByRole("button", { name: "1" }));
    expect(await screen.findByText("Meeting 1-0")).toBeInTheDocument();

    expect(getAllMeetings).not.toHaveBeenCalled();
  });
});
