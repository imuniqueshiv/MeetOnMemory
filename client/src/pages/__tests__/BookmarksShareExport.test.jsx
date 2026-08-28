import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Bookmarks from "../Bookmarks.jsx";
import { getBookmarksAPI, getCollectionsAPI } from "../../api/bookmarkApi.js";
import AppContent from "../../context/AppContent";

vi.mock("../../api/bookmarkApi.js", () => ({
  getBookmarksAPI: vi.fn(),
  getCollectionsAPI: vi.fn(),
  shareCollectionAPI: vi.fn(),
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.stubGlobal("URL", {
  createObjectURL: vi.fn().mockReturnValue("blob:test"),
  revokeObjectURL: vi.fn(),
});

describe("Bookmarks Search, Share, Export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles export of bookmarks", async () => {
    getCollectionsAPI.mockResolvedValue([
      { name: "Research", count: 1, color: "blue" },
    ]);
    getBookmarksAPI.mockResolvedValue([
      {
        _id: "1",
        notes: "test note",
        collectionName: "Research",
        color: "blue",
        meeting: { title: "Meeting 1" },
      },
    ]);

    render(
      <MemoryRouter>
        <AppContent.Provider value={{ userData: { id: "123" } }}>
          <Bookmarks />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    // Click Research collection
    const collectionBtns = await screen.findAllByText(/Research/i);
    fireEvent.click(collectionBtns[0]);

    // Click export
    const exportBtn = screen.getByText("Export");

    // Mock anchor click
    const createElementSpy = vi.spyOn(document, "createElement");
    const a = document.createElement("a");
    const clickSpy = vi.spyOn(a, "click");
    createElementSpy.mockReturnValue(a);

    fireEvent.click(exportBtn);

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(a.download).toBe("Research_bookmarks.json");
    expect(clickSpy).toHaveBeenCalled();
  });
});
