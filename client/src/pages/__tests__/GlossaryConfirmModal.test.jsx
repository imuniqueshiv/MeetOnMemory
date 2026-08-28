import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Glossary from "../Glossary.jsx";
import * as api from "../../services/glossaryApi.js";

vi.mock("../../services/glossaryApi.js", () => ({
  fetchTerms: vi.fn(),
  createTerm: vi.fn(),
  deleteTerm: vi.fn(),
  approveTerm: vi.fn(),
  rejectTerm: vi.fn(),
}));

describe("Glossary Confirmation Modal (#1489)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens deletion confirmation modal and deletes term on confirm", async () => {
    api.fetchTerms.mockResolvedValue([
      {
        _id: "term-1",
        term: "ROI",
        definition: "Return on Investment",
        approvalStatus: "approved",
      },
    ]);
    api.deleteTerm.mockResolvedValue({ success: true });

    render(<Glossary />);

    await waitFor(() => {
      expect(screen.getByText("ROI")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /^delete$/i });
    fireEvent.click(deleteButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/delete glossary term/i)).toBeInTheDocument();

    const confirmButtons = screen.getAllByRole("button", {
      name: /delete term/i,
    });
    const confirmButton = confirmButtons[confirmButtons.length - 1];
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(api.deleteTerm).toHaveBeenCalledWith("term-1");
    });
  });
});
