import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import useTeamManagement from "../useTeamManagement";
import { organizationApi, invitationApi } from "../../services";
import AppContent from "../../context/AppContent";

// Mock API services
vi.mock("../../services", () => ({
  organizationApi: {
    getMembers: vi.fn(),
  },
  invitationApi: {
    getOrganizationInvitations: vi.fn(),
    createInvitation: vi.fn(),
    resendInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
    expireInvitation: vi.fn(),
  },
}));

// Mock react-toastify
vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useTeamManagement", () => {
  const mockUserData = {
    role: "admin",
    organization: { _id: "org1" },
  };

  const wrapper = ({ children }) => (
    <AppContent.Provider value={{ userData: mockUserData }}>
      {children}
    </AppContent.Provider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    organizationApi.getMembers.mockResolvedValue({
      data: { success: true, members: [] },
    });
    invitationApi.getOrganizationInvitations.mockResolvedValue({
      data: { success: true, invitations: [] },
    });
  });

  it("initializes and fetches members automatically", async () => {
    const mockMembers = [{ _id: "1", name: "Test User" }];
    organizationApi.getMembers.mockResolvedValueOnce({
      data: { success: true, members: mockMembers },
    });

    const { result } = renderHook(() => useTeamManagement("members"), {
      wrapper,
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.isAdmin).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.members).toEqual(mockMembers);
    expect(organizationApi.getMembers).toHaveBeenCalledTimes(1);
  });

  it("fetches invitations when active tab is invitations and user is admin", async () => {
    const mockInvitations = [{ _id: "inv1", email: "test@invite.com" }];
    invitationApi.getOrganizationInvitations.mockResolvedValueOnce({
      data: { success: true, invitations: mockInvitations },
    });

    const { result } = renderHook(() => useTeamManagement("invitations"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.invitesLoading).toBe(false);
    });

    expect(result.current.invitations).toEqual(mockInvitations);
    expect(invitationApi.getOrganizationInvitations).toHaveBeenCalledWith(
      "org1",
    );
  });

  it("handles send invite", async () => {
    invitationApi.createInvitation.mockResolvedValueOnce({
      data: { success: true },
    });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useTeamManagement("invitations"), {
      wrapper,
    });

    await act(async () => {
      await result.current.handleSendInvite(
        { email: "test@example.com" },
        onSuccess,
      );
    });

    expect(invitationApi.createInvitation).toHaveBeenCalledWith({
      organizationId: "org1",
      email: "test@example.com",
    });
    expect(onSuccess).toHaveBeenCalled();
  });
});
