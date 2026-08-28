import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import E2eeRolloutPanel from "../E2eeRolloutPanel.jsx";
import * as encryptionModule from "../../../utils/encryption/index.js";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("E2eeRolloutPanel (#2263)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders disabled status when e2ee is disabled", async () => {
    vi.spyOn(encryptionModule, "checkClientE2eeSupport").mockResolvedValueOnce({
      supported: true,
      hasWebCrypto: true,
      hasAesGcm: true,
      hasLocalStorage: true,
    });

    render(
      <E2eeRolloutPanel
        organizationId="org-123"
        e2eeSettings={{ enabled: false, enforceOrgWide: false }}
        canEdit={true}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByText("End-to-End Encryption (E2EE)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(
      screen.getByText(/Rollout Readiness Checklist/i),
    ).toBeInTheDocument();
  });

  it("detects and displays browser crypto support in the checklist", async () => {
    vi.spyOn(encryptionModule, "checkClientE2eeSupport").mockResolvedValueOnce({
      supported: true,
      hasWebCrypto: true,
      hasAesGcm: true,
      hasLocalStorage: true,
    });

    render(
      <E2eeRolloutPanel
        organizationId="org-123"
        e2eeSettings={{ enabled: true, enforceOrgWide: false }}
        canEdit={true}
        onSave={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Available")).toBeInTheDocument();
    });

    expect(screen.getByText("Supported")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Enabled (Optional)")).toBeInTheDocument();
  });

  it("allows admins to toggle E2EE and org-wide enforcement and trigger save callback", async () => {
    vi.spyOn(encryptionModule, "checkClientE2eeSupport").mockResolvedValueOnce({
      supported: true,
      hasWebCrypto: true,
      hasAesGcm: true,
      hasLocalStorage: true,
    });

    const mockSave = vi.fn().mockResolvedValueOnce({});

    render(
      <E2eeRolloutPanel
        organizationId="org-123"
        e2eeSettings={{ enabled: false, enforceOrgWide: false }}
        canEdit={true}
        onSave={mockSave}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const enableCheckbox = checkboxes[0];
    const enforceCheckbox = checkboxes[1];

    expect(enforceCheckbox).toBeDisabled();

    // Toggle Enable
    fireEvent.click(enableCheckbox);

    // Now Enforce should be enabled
    expect(enforceCheckbox).not.toBeDisabled();
    fireEvent.click(enforceCheckbox);

    // Click Save
    const saveBtn = screen.getByRole("button", {
      name: /Save E2EE Settings/i,
    });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith({
        enabled: true,
        enforceOrgWide: true,
      });
    });
  });

  it("disables toggles for non-admin viewers", async () => {
    vi.spyOn(encryptionModule, "checkClientE2eeSupport").mockResolvedValueOnce({
      supported: true,
      hasWebCrypto: true,
      hasAesGcm: true,
      hasLocalStorage: true,
    });

    render(
      <E2eeRolloutPanel
        organizationId="org-123"
        e2eeSettings={{ enabled: true, enforceOrgWide: true }}
        canEdit={false}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((cb) => expect(cb).toBeDisabled());

    expect(
      screen.queryByRole("button", { name: /Save E2EE Settings/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Enforced Org-Wide")).toBeInTheDocument();
  });
});
