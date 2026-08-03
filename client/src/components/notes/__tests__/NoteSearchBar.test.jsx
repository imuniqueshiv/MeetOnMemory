import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import NoteSearchBar from "../NoteSearchBar";

describe("NoteSearchBar Component", () => {
  it("renders search input correctly", () => {
    render(
      <NoteSearchBar
        searchQuery=""
        onSearchChange={() => {}}
        onClear={() => {}}
      />,
    );
    expect(
      screen.getByRole("searchbox", { name: /search notes/i }),
    ).toBeInTheDocument();
  });

  it("triggers onSearchChange when user types", () => {
    const handleSearchChange = vi.fn();
    render(
      <NoteSearchBar
        searchQuery=""
        onSearchChange={handleSearchChange}
        onClear={() => {}}
      />,
    );

    const input = screen.getByRole("searchbox", { name: /search notes/i });
    fireEvent.change(input, { target: { value: "architecture" } });
    expect(handleSearchChange).toHaveBeenCalledWith("architecture");
  });

  it("displays clear button when query is present and triggers onClear", () => {
    const handleClear = vi.fn();
    render(
      <NoteSearchBar
        searchQuery="meeting"
        onSearchChange={() => {}}
        onClear={handleClear}
      />,
    );

    const clearButton = screen.getByRole("button", { name: /clear search/i });
    expect(clearButton).toBeInTheDocument();
    fireEvent.click(clearButton);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it("handles filter type change when dropdown is changed", () => {
    const handleFilterChange = vi.fn();
    render(
      <NoteSearchBar
        searchQuery=""
        onSearchChange={() => {}}
        filterType="all"
        onFilterTypeChange={handleFilterChange}
        onClear={() => {}}
      />,
    );

    const select = screen.getByRole("combobox", { name: /filter by field/i });
    fireEvent.change(select, { target: { value: "title" } });
    expect(handleFilterChange).toHaveBeenCalledWith("title");
  });
});
