import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PrintMomModal from "../PrintMomModal";

describe("PrintMomModal (#2255)", () => {
  const mockMeeting = {
    _id: "meeting-123456",
    title: "Q3 Roadmap Alignment",
    date: "2026-08-26T10:00:00Z",
  };

  const mockSummary = {
    title: "Q3 Roadmap Alignment",
    summary: "Key decisions on architecture and milestones were agreed upon.",
  };

  it("renders modal when open and displays meeting details", () => {
    render(
      <PrintMomModal
        isOpen={true}
        onClose={vi.fn()}
        meeting={mockMeeting}
        summary={mockSummary}
      />,
    );

    expect(screen.getByText("Print Meeting Minutes")).toBeInTheDocument();
    expect(screen.getByText("Q3 Roadmap Alignment")).toBeInTheDocument();
    expect(
      screen.getByText("Include Decisions & Consensus Log"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Include Action Items & Assigned Owners"),
    ).toBeInTheDocument();
  });

  it("triggers window.print and calls onClose when clicking Open Print Dialog", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const onClose = vi.fn();

    render(
      <PrintMomModal
        isOpen={true}
        onClose={onClose}
        meeting={mockMeeting}
        summary={mockSummary}
      />,
    );

    const printBtn = screen.getByRole("button", {
      name: /open print dialog/i,
    });
    fireEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
