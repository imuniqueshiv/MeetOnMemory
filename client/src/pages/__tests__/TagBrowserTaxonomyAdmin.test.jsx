import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import TagBrowser from "../TagBrowser";
import { tagApi } from "../../services";
import AppContent from "../../context/AppContent";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../services", () => ({
  tagApi: {
    getOrgTags: vi.fn(),
    createTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
    mergeTags: vi.fn(),
    bulkRetag: vi.fn(),
    exportTags: vi.fn(),
    getMeetingsByTag: vi.fn(),
  },
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}));

describe("TagBrowser Taxonomy Administration (#2244)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAdminContext = {
    userData: { _id: "user-1", name: "Admin", role: "admin" },
  };

  const mockTags = [
    { _id: "tag-1", name: "Architecture", color: "#3B82F6", usageCount: 5 },
    { _id: "tag-2", name: "SystemDesign", color: "#10B981", usageCount: 3 },
  ];

  it("renders export CSV button and triggers exportTags API", async () => {
    tagApi.getOrgTags.mockResolvedValue({
      data: { success: true, data: mockTags },
    });
    tagApi.exportTags.mockResolvedValue({
      data: "Name,Color,UsageCount\nArchitecture,#3B82F6,5",
    });

    render(
      <AppContent.Provider value={mockAdminContext}>
        <BrowserRouter>
          <TagBrowser />
        </BrowserRouter>
      </AppContent.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Architecture")).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole("button", {
      name: "Export tag taxonomy stats",
    });
    expect(exportBtn).toBeInTheDocument();
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(tagApi.exportTags).toHaveBeenCalledTimes(1);
    });
  });

  it("opens Merge Tags modal and calls mergeTags API on submit", async () => {
    tagApi.getOrgTags.mockResolvedValue({
      data: { success: true, data: mockTags },
    });
    tagApi.mergeTags.mockResolvedValue({
      data: { success: true, message: "Tags merged successfully!" },
    });

    render(
      <AppContent.Provider value={mockAdminContext}>
        <BrowserRouter>
          <TagBrowser />
        </BrowserRouter>
      </AppContent.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Architecture")).toBeInTheDocument();
    });

    const mergeBtn = screen.getByRole("button", {
      name: "Merge taxonomy tags",
    });
    fireEvent.click(mergeBtn);

    expect(
      screen.getByRole("dialog", { name: "Merge Taxonomy Tags Dialog" }),
    ).toBeInTheDocument();

    const sourceSelect = screen.getByTestId("merge-source-select");
    const targetSelect = screen.getByTestId("merge-target-select");

    fireEvent.change(sourceSelect, { target: { value: "tag-1" } });
    fireEvent.change(targetSelect, { target: { value: "tag-2" } });

    const confirmBtn = screen.getByTestId("confirm-merge-tags-button");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(tagApi.mergeTags).toHaveBeenCalledWith({
        sourceTagId: "tag-1",
        targetTagId: "tag-2",
      });
    });
  });
});
