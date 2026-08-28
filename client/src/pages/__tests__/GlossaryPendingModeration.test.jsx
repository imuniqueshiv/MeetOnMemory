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

describe("Glossary pending moderation (#2245)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a pending term with a reason", async () => {
    api.fetchTerms.mockResolvedValue([
      {
        _id: "pending-1",
        term: "K8s",
        definition: "Kubernetes",
        approvalStatus: "pending",
      },
      {
        _id: "approved-1",
        term: "ROI",
        definition: "Return on Investment",
        approvalStatus: "approved",
      },
    ]);
    api.rejectTerm.mockResolvedValue({
      _id: "pending-1",
      approvalStatus: "rejected",
    });

    render(<Glossary />);

    await waitFor(() => {
      expect(screen.getByText("K8s")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^reject$/i }));
    fireEvent.change(
      screen.getByPlaceholderText(/incorrect definition or duplicate concept/i),
      { target: { value: "Not relevant to our org" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm reject/i }));

    await waitFor(() => {
      expect(api.rejectTerm).toHaveBeenCalledWith(
        "pending-1",
        "Not relevant to our org",
      );
    });
  });

  it("approves a pending term after editing", async () => {
    api.fetchTerms.mockResolvedValue([
      {
        _id: "pending-1",
        term: "K8s",
        definition: "Bad definition",
        category: "General",
        approvalStatus: "pending",
      },
    ]);
    api.approveTerm.mockResolvedValue({
      _id: "pending-1",
      approvalStatus: "approved",
    });

    render(<Glossary />);

    await waitFor(() => {
      expect(screen.getByText("K8s")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /edit & approve/i }));
    fireEvent.change(screen.getByDisplayValue("Bad definition"), {
      target: { value: "Kubernetes orchestration platform" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save & approve/i }));

    await waitFor(() => {
      expect(api.approveTerm).toHaveBeenCalledWith("pending-1", {
        term: "K8s",
        definition: "Kubernetes orchestration platform",
        category: "General",
      });
    });
  });
});
