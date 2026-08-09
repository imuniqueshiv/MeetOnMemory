import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PolicyCompliance from "../PolicyCompliance.jsx";
import { policyComplianceApi } from "../../services";

vi.mock("../../services", () => ({
  policyComplianceApi: {
    getFlags: vi.fn(),
    updateFlagStatus: vi.fn(),
  },
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

describe("PolicyCompliance Component (Issue #911)", () => {
  const mockFlags = [
    {
      _id: "flag-1",
      classification: "potential_conflict",
      status: "unresolved",
      similarityScore: 0.85,
      decisionId: { text: "Use third-party encryption key" },
      policyId: { name: "Data Security Policy", version: "1.2" },
      reasoning: "Conflicts with section 4: Internal Key Management",
    },
    {
      _id: "flag-2",
      classification: "aligned",
      status: "unresolved",
      similarityScore: 0.92,
      decisionId: { text: "Enforce MFA for all admin logins" },
      policyId: { name: "Access Control Policy", version: "2.0" },
      reasoning: "Fully satisfies section 2: Authentication Controls",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches all compliance classifications by default and displays summary badges", async () => {
    policyComplianceApi.getFlags.mockResolvedValue({
      data: {
        success: true,
        flags: mockFlags,
      },
    });

    render(
      <MemoryRouter>
        <PolicyCompliance />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(policyComplianceApi.getFlags).toHaveBeenCalledWith(
        "unresolved",
        "all",
      );
    });

    expect(
      await screen.findByText("Use third-party encryption key"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Enforce MFA for all admin logins"),
    ).toBeInTheDocument();
    expect(screen.getByText("Potential Conflict")).toBeInTheDocument();
  });

  it("switches classification tab and fetches flags for selected classification", async () => {
    policyComplianceApi.getFlags.mockResolvedValue({
      data: {
        success: true,
        flags: mockFlags,
      },
    });

    render(
      <MemoryRouter>
        <PolicyCompliance />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(policyComplianceApi.getFlags).toHaveBeenCalledWith(
        "unresolved",
        "all",
      );
    });

    policyComplianceApi.getFlags.mockResolvedValueOnce({
      data: {
        success: true,
        flags: [mockFlags[1]],
      },
    });

    const alignedButtons = screen.getAllByRole("button");
    const alignedTab = alignedButtons.find((btn) =>
      btn.textContent.includes("Aligned"),
    );
    expect(alignedTab).toBeTruthy();

    fireEvent.click(alignedTab);

    await waitFor(() => {
      expect(policyComplianceApi.getFlags).toHaveBeenCalledWith(
        "unresolved",
        "aligned",
      );
    });
  });
});
