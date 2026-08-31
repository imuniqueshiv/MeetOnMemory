import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DangerZone from "../DangerZone.jsx";
import { organizationApi } from "../../../services/organizationApi.js";
import { toast } from "react-toastify";

vi.mock("../../../services/organizationApi.js", () => ({
  organizationApi: {
    deleteOrganization: vi.fn(),
    leaveOrganization: vi.fn(),
    transferOwnership: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("DangerZone Component Audit Persistence (#2642)", () => {
  const mockOrg = {
    _id: "org-123",
    name: "Acme Corp",
    owner: "user-owner",
  };

  const mockUser = {
    id: "user-123",
    name: "John Doe",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("sends a persistent audit log to the server before deleting an organization", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        message: "Durable organization audit trail captured successfully.",
      }),
    });

    organizationApi.deleteOrganization.mockResolvedValueOnce({
      data: { success: true },
    });

    render(
      <MemoryRouter>
        <DangerZone
          organization={mockOrg}
          currentUser={mockUser}
          userRole="owner"
        />
      </MemoryRouter>,
    );

    // Expand danger zone
    const expandHeader = screen.getByText(/Danger Zone/i);
    fireEvent.click(expandHeader);

    // Click delete organization button to open modal
    const deleteBtn = screen.getByRole("button", {
      name: /Delete Organization/i,
    });
    fireEvent.click(deleteBtn);

    // Type keyword "delete" in confirm modal
    const keywordInput = screen.getByPlaceholderText('Type "delete" here...');
    fireEvent.change(keywordInput, { target: { value: "delete" } });

    // Type org name "Acme Corp" in org name input
    const orgNameInput = screen.getByPlaceholderText(
      'Type "Acme Corp" here...',
    );
    fireEvent.change(orgNameInput, { target: { value: "Acme Corp" } });

    // Click confirm in modal
    const confirmButtons = screen.getAllByRole("button", {
      name: /Delete Organization/i,
    });
    const modalConfirmBtn = confirmButtons[confirmButtons.length - 1];
    fireEvent.click(modalConfirmBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/organizations/org-123/audit",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            action: "ORG_DELETION",
            userId: "user-123",
            details: "User initiated permanent organization deletion",
          }),
        }),
      );
      expect(organizationApi.deleteOrganization).toHaveBeenCalledWith(
        "org-123",
      );
    });
  });

  it("blocks destructive action if audit log recording fails", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(
      <MemoryRouter>
        <DangerZone
          organization={mockOrg}
          currentUser={mockUser}
          userRole="owner"
        />
      </MemoryRouter>,
    );

    // Expand danger zone
    const expandHeader = screen.getByText(/Danger Zone/i);
    fireEvent.click(expandHeader);

    // Click delete button
    const deleteBtn = screen.getByRole("button", {
      name: /Delete Organization/i,
    });
    fireEvent.click(deleteBtn);

    // Type keyword "delete" in confirm modal
    const keywordInput = screen.getByPlaceholderText('Type "delete" here...');
    fireEvent.change(keywordInput, { target: { value: "delete" } });

    // Type org name "Acme Corp" in org name input
    const orgNameInput = screen.getByPlaceholderText(
      'Type "Acme Corp" here...',
    );
    fireEvent.change(orgNameInput, { target: { value: "Acme Corp" } });

    // Click confirm in modal
    const confirmButtons = screen.getAllByRole("button", {
      name: /Delete Organization/i,
    });
    const modalConfirmBtn = confirmButtons[confirmButtons.length - 1];
    fireEvent.click(modalConfirmBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
      expect(organizationApi.deleteOrganization).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Security boundary error"),
      );
    });
  });
});
