import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AiSearch from "../AiSearch";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

const apiPost = vi.fn();

vi.mock("../../services", () => ({
  apiClient: {
    post: (...args) => apiPost(...args),
  },
}));

describe("AiSearch meeting navigation (#615)", () => {
  let openSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it("opens the singular /meeting/:id route from a standard search result", async () => {
    apiPost.mockResolvedValue({
      data: {
        results: [
          {
            meetingId: "mtg-123",
            title: "Sprint Planning",
            summary: "Discussed backlog",
            resultType: "meeting",
            createdAt: "2024-06-01T00:00:00.000Z",
          },
        ],
      },
    });

    render(<AiSearch />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "sprint planning" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(screen.getByText("Sprint Planning")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /open meeting/i }));

    expect(openSpy).toHaveBeenCalledWith("/meeting/mtg-123", "_blank");
    expect(
      openSpy.mock.calls.some(([url]) => String(url).includes("/meetings/")),
    ).toBe(false);
  });

  it("opens /meeting/:id from a hybrid search result source meeting", async () => {
    apiPost.mockResolvedValue({
      data: {
        results: [
          {
            key: "decision-1",
            type: "decision",
            id: "dec-1",
            title: "Ship v2",
            summary: "Approved shipping",
            semanticScore: 0.8,
            graphScore: 0.4,
            finalScore: 0.7,
            hops: 1,
            sourceMeeting: {
              id: "mtg-456",
              createdAt: "2024-07-01T00:00:00.000Z",
            },
          },
        ],
      },
    });

    render(<AiSearch />);

    fireEvent.click(screen.getByRole("button", { name: /hybrid/i }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "ship v2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(screen.getByText("Ship v2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /open meeting/i }));

    expect(openSpy).toHaveBeenCalledWith("/meeting/mtg-456", "_blank");
  });
});
