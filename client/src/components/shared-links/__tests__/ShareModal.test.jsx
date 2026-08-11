import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ShareModal from "../ShareModal";
import AppContent from "../../../context/AppContent";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const getActiveLinks = vi.fn();

vi.mock("../../../services", () => ({
  sharedLinkApi: {
    getActiveLinks: (...args) => getActiveLinks(...args),
    createLink: vi.fn(),
    revokeLink: vi.fn(),
  },
}));

const renderModal = (userData, links = []) => {
  getActiveLinks.mockResolvedValue({
    data: { success: true, links },
  });

  return render(
    <AppContent.Provider value={{ userData }}>
      <ShareModal
        isOpen
        onClose={vi.fn()}
        resourceId="meeting-1"
        resourceType="Meeting"
        title="Weekly Sync"
      />
    </AppContent.Provider>,
  );
};

describe("ShareModal analytics (#723)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while links are fetched", async () => {
    let resolveFetch;
    getActiveLinks.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(
      <AppContent.Provider value={{ userData: { role: "member" } }}>
        <ShareModal
          isOpen
          onClose={vi.fn()}
          resourceId="meeting-1"
          resourceType="Meeting"
          title="Weekly Sync"
        />
      </AppContent.Provider>,
    );

    expect(screen.getByTestId("shared-links-loading")).toBeInTheDocument();

    resolveFetch({ data: { success: true, links: [] } });
    await waitFor(() => {
      expect(screen.getByTestId("shared-links-empty")).toBeInTheDocument();
    });
  });

  it("renders analytics for authorized members", async () => {
    renderModal({ role: "member", organization: { _id: "org-1" } }, [
      {
        _id: "link-1",
        hash: "abc123",
        hasPasscode: true,
        totalViews: 4,
        lastAccessed: "2024-06-01T12:00:00.000Z",
        failedPasscodeAttempts: 3,
      },
    ]);

    expect(
      await screen.findByTestId("shared-link-analytics"),
    ).toBeInTheDocument();
    expect(screen.getByText(/4 views/i)).toBeInTheDocument();
    expect(screen.getByText(/3 failed passcode attempts/i)).toBeInTheDocument();
  });

  it("shows empty analytics state when there is no activity", async () => {
    renderModal({ role: "admin" }, [
      {
        _id: "link-2",
        hash: "newlink",
        hasPasscode: false,
        totalViews: 0,
        lastAccessed: null,
        failedPasscodeAttempts: 0,
      },
    ]);

    expect(
      await screen.findByTestId("shared-link-analytics-empty"),
    ).toHaveTextContent(/No access activity yet/i);
  });

  it("hides analytics for viewers without edit permission", async () => {
    renderModal({ role: "viewer", organization: { _id: "org-1" } }, [
      {
        _id: "link-3",
        hash: "viewer-link",
        hasPasscode: false,
        totalViews: 9,
        lastAccessed: "2024-06-01T12:00:00.000Z",
        failedPasscodeAttempts: 1,
      },
    ]);

    await screen.findByText(/viewer-link/);
    expect(
      screen.queryByTestId("shared-link-analytics"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("shared-link-analytics-empty"),
    ).not.toBeInTheDocument();
  });
});
