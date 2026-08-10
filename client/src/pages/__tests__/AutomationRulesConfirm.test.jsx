import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

describe("AutomationRules Confirmation Modal (#1369)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens deletion confirmation modal and deletes rule on confirm", async () => {
    api.fetchRules.mockResolvedValue([
      {
        _id: "rule-1",
        name: "Notify Slack on meeting creation",
        isActive: true,
        trigger: { event: "meeting.created" },
        actions: [{ type: "slack" }],
      },
    ]);
    api.deleteRule.mockResolvedValue({ success: true });

    render(<AutomationRules />);

    await waitFor(() => {
      expect(
        screen.getByText("Notify Slack on meeting creation"),
      ).toBeInTheDocument();
    });

    const deleteButton = screen.getByTitle("Delete Rule");
    fireEvent.click(deleteButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/delete automation rule/i)).toBeInTheDocument();

    const confirmButtons = screen.getAllByRole("button", {
      name: /delete rule/i,
    });
    const confirmButton = confirmButtons[confirmButtons.length - 1];
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(api.deleteRule).toHaveBeenCalledWith("rule-1");
    });
  });
});
