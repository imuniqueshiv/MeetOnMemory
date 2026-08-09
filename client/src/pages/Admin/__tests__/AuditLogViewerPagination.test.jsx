import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AuditLogViewer from "../AuditLogViewer.jsx";
import AppContent from "../../../context/AppContent.js";
import { RBACProvider } from "../../../context/RBACContext.jsx";
import { ThemeProvider } from "../../../context/ThemeContext.jsx";
import { organizationApi } from "../../../services";

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({ user: null }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../services", () => ({
  organizationApi: {
    getAuditLogs: vi.fn(),
  },
  userApi: {
    getUserOrgs: vi
      .fn()
      .mockResolvedValue({ data: { success: true, organizations: [] } }),
    getNotifications: vi
      .fn()
      .mockResolvedValue({ data: { success: true, notifications: [] } }),
  },
}));

const mockUserData = {
  organization: { _id: "org-123", name: "Engineering Org" },
};

describe("AuditLogViewer Pagination & Filtering (#1306)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders audit log table with pagination and per-page selector", async () => {
    organizationApi.getAuditLogs.mockResolvedValue({
      data: {
        success: true,
        logs: [
          {
            _id: "log-1",
            createdAt: "2026-08-01T10:00:00.000Z",
            action: "MEMBER_ROLE_CHANGED",
            actor: { name: "Admin Alice" },
            entity: "User Bob",
            details: { newRole: "admin" },
          },
        ],
        pagination: { page: 1, total: 30, pages: 2 },
      },
    });

    render(
      <MemoryRouter>
        <ThemeProvider>
          <AppContent.Provider value={{ userData: mockUserData }}>
            <RBACProvider>
              <AuditLogViewer />
            </RBACProvider>
          </AppContent.Provider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Admin Alice")).toBeInTheDocument();
    });

    expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/select logs per page/i)).toBeInTheDocument();

    const nextPageBtn = screen.getByRole("button", { name: /next page/i });
    fireEvent.click(nextPageBtn);

    expect(organizationApi.getAuditLogs).toHaveBeenCalledWith(
      "org-123",
      expect.objectContaining({ page: 2 }),
    );
  });
});
