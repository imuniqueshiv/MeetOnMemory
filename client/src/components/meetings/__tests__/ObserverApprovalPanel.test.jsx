import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ObserverApprovalPanel from "../ObserverApprovalPanel";
import * as observerHook from "../../../hooks/useObservers";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("ObserverApprovalPanel (#2445)", () => {
  const mockShadowRequest = vi.fn();
  const mockHandleShadowRequest = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(observerHook, "useObservers").mockReturnValue({
      isLoading: false,
      shadowRequest: mockShadowRequest,
      handleShadowRequest: mockHandleShadowRequest,
    });
  });

  const mockMeeting = {
    _id: "m_1",
    title: "Executive Board Sync",
    uploadedBy: "u_host",
    allowObservers: true,
    participants: [
      { user: "u_host", name: "Host User", role: "host" },
      {
        user: "u_obs1",
        name: "Observer One",
        email: "obs1@example.com",
        role: "observer",
      },
    ],
  };

  it("renders observer roster when user is the meeting host", () => {
    render(
      <ObserverApprovalPanel
        meeting={mockMeeting}
        currentUser={{ _id: "u_host" }}
      />,
    );

    expect(screen.getByTestId("observer-management-panel")).toBeInTheDocument();
    expect(screen.getByText("Observer & Shadow Roster")).toBeInTheDocument();
    expect(screen.getByText("Observer One")).toBeInTheDocument();
    expect(screen.getByText("1 Active")).toBeInTheDocument();
  });

  it("renders shadow request button when user is a guest / non-participant", async () => {
    render(
      <ObserverApprovalPanel
        meeting={mockMeeting}
        currentUser={{ _id: "u_guest", email: "guest@example.com" }}
      />,
    );

    expect(screen.getByTestId("observer-request-card")).toBeInTheDocument();
    expect(screen.getByTestId("request-shadow-button")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("request-shadow-button"));

    await waitFor(() => {
      expect(mockShadowRequest).toHaveBeenCalledWith("m_1");
    });
  });
});
