import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AiMinutesCard from "../AiMinutesCard.jsx";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-markdown", () => ({
  default: ({ children }) => (
    <div data-testid="markdown-renderer">{children}</div>
  ),
}));

describe("AiMinutesCard Component", () => {
  const defaultProps = {
    isSummarizing: false,
    summary: "# Meeting Minutes\n- Action Item 1\n- Decision 1",
    handleGenerateSummary: vi.fn(),
    onRegenerate: vi.fn(),
    onSaveSection: vi.fn(),
    showExportMenu: false,
    setShowExportMenu: vi.fn(),
    isExporting: false,
    handleExport: vi.fn(),
    canEdit: true,
    canGenerate: true,
    canExport: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when summary is empty", () => {
    render(<AiMinutesCard {...defaultProps} summary="" />);

    expect(screen.getByText("No summary generated yet.")).toBeInTheDocument();
    expect(
      screen.getByText(/click "generate mom" to create structured minutes/i),
    ).toBeInTheDocument();
  });

  it("renders loading state when isSummarizing is true", () => {
    render(<AiMinutesCard {...defaultProps} isSummarizing={true} />);

    expect(
      screen.getByText("AI is analyzing your meeting..."),
    ).toBeInTheDocument();
  });

  it("renders summary markdown content when summary is provided", () => {
    render(<AiMinutesCard {...defaultProps} />);

    expect(screen.getByTestId("markdown-renderer")).toHaveTextContent(
      /Meeting Minutes/i,
    );
  });

  it("toggles section edit mode and saves edited section content", async () => {
    const onSaveSection = vi.fn().mockResolvedValue(true);

    render(<AiMinutesCard {...defaultProps} onSaveSection={onSaveSection} />);

    const editBtn = screen.getByRole("button", { name: /edit section/i });
    fireEvent.click(editBtn);

    const textarea = screen.getByPlaceholderText(
      /edit structured mom content/i,
    );
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, {
      target: { value: "# Updated Minutes\n- Action Item 2" },
    });

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSaveSection).toHaveBeenCalledWith(
        "# Updated Minutes\n- Action Item 2",
      );
    });
  });

  it("respects RBAC edit gate by hiding edit button when canEdit is false", () => {
    render(<AiMinutesCard {...defaultProps} canEdit={false} />);

    expect(
      screen.queryByRole("button", { name: /edit section/i }),
    ).not.toBeInTheDocument();
  });

  it("displays error alert banner when isError is true", () => {
    render(
      <AiMinutesCard
        {...defaultProps}
        isError={true}
        errorMessage="Network error during MoM generation"
      />,
    );

    expect(
      screen.getByText("Network error during MoM generation"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("triggers export dropdown and export handler", () => {
    const handleExport = vi.fn();
    const setShowExportMenu = vi.fn();

    render(
      <AiMinutesCard
        {...defaultProps}
        showExportMenu={true}
        setShowExportMenu={setShowExportMenu}
        handleExport={handleExport}
      />,
    );

    const pdfBtn = screen.getByRole("button", { name: /pdf document/i });
    fireEvent.click(pdfBtn);

    expect(handleExport).toHaveBeenCalledWith("pdf");
    expect(setShowExportMenu).toHaveBeenCalledWith(false);
  });
});
