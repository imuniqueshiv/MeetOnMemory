import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AutomationRules from "../AutomationRules.jsx";
import * as api from "../../services/automationRuleApi.js";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../services/automationRuleApi.js", () => ({
  fetchRules: vi.fn(),
  toggleRuleStatus: vi.fn(),
  deleteRule: vi.fn(),
  createRule: vi.fn(),
}));

describe("AutomationRules Dark Mode (#1371)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders container and cards with dark mode CSS utility classes", async () => {
    api.fetchRules.mockResolvedValue([
      {
        _id: "rule-1",
        name: "Notify Slack on meeting creation",
        isActive: true,
        trigger: { event: "meeting.created" },
        actions: [{ type: "slack" }],
      },
    ]);

    const { container } = render(<AutomationRules />);

    await waitFor(() => {
      expect(
        screen.getByText("Notify Slack on meeting creation"),
      ).toBeInTheDocument();
    });

    const rootContainer = container.firstChild;
    expect(rootContainer).toHaveClass("dark:bg-gray-900");
    expect(rootContainer).toHaveClass("dark:text-gray-100");
  });
});
