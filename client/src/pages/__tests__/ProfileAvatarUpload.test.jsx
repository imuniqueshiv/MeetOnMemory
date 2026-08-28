import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Profile from "../Profile.jsx";
import { userApi } from "../../services";
import AppContent from "../../context/AppContent";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="app-navbar">App Navbar</div>,
}));

vi.mock("../../services", () => ({
  userApi: {
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../hooks/useSkillEndorsements", () => ({
  useSkillEndorsements: () => ({
    getUserEndorsements: vi.fn().mockResolvedValue([]),
    loading: false,
  }),
}));

const mockUserData = {
  _id: "user-123",
  name: "Avatar Test User",
  email: "avatar@example.com",
  isAccountVerified: true,
  role: "member",
  organization: { name: "Test Corp" },
  profilePic: "https://example.com/old-avatar.png",
  bio: "Hello world",
  createdAt: new Date().toISOString(),
};

describe("Profile Page Avatar File Upload (#2479)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render file input, allow selecting file, and upload avatar followed by profile update on save", async () => {
    userApi.uploadAvatar.mockResolvedValue({
      data: { success: true, profilePic: "/uploads/avatars/avatar-new.png" },
    });
    userApi.updateProfile.mockResolvedValue({
      data: {
        success: true,
        user: {
          ...mockUserData,
          profilePic: "/uploads/avatars/avatar-new.png",
        },
        message: "Profile updated",
      },
    });

    const setUserDataMock = vi.fn();

    render(
      <AppContent.Provider
        value={{ userData: mockUserData, setUserData: setUserDataMock }}
      >
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </AppContent.Provider>,
    );

    // Verify view state details
    expect(screen.getByText("Avatar Test User")).toBeInTheDocument();

    // Click Edit Profile to open edit state
    const editBtn = screen.getByText("Edit Profile");
    fireEvent.click(editBtn);

    // Verify avatar uploader label is shown
    expect(screen.getByText("Avatar Image Upload")).toBeInTheDocument();

    // Select a file
    const fileInput = screen.getByTestId("avatar-file-input");
    const file = new File(["dummy content"], "test-avatar.png", {
      type: "image/png",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Click Save Changes
    const saveBtn = screen.getByText("Save Changes");
    fireEvent.click(saveBtn);

    // Verify uploader and profile update are triggered sequentially
    await waitFor(() => {
      expect(userApi.uploadAvatar).toHaveBeenCalled();
      expect(userApi.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Avatar Test User",
          profilePic: "/uploads/avatars/avatar-new.png",
        }),
      );
      expect(setUserDataMock).toHaveBeenCalledWith(
        expect.objectContaining({
          profilePic: "/uploads/avatars/avatar-new.png",
        }),
      );
    });
  });

  it("should support falling back to manually typed profile picture URLs", async () => {
    userApi.updateProfile.mockResolvedValue({
      data: {
        success: true,
        user: {
          ...mockUserData,
          profilePic: "https://example.com/new-url.png",
        },
        message: "Profile updated",
      },
    });

    const setUserDataMock = vi.fn();

    render(
      <AppContent.Provider
        value={{ userData: mockUserData, setUserData: setUserDataMock }}
      >
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </AppContent.Provider>,
    );

    // Go to edit profile
    fireEvent.click(screen.getByText("Edit Profile"));

    // Modify Image URL fallback input
    const urlInput = screen.getByLabelText("Image URL (Fallback)");
    fireEvent.change(urlInput, {
      target: { value: "https://example.com/new-url.png" },
    });

    // Save
    fireEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      // Should NOT upload file
      expect(userApi.uploadAvatar).not.toHaveBeenCalled();
      // Should save the fallback URL directly
      expect(userApi.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          profilePic: "https://example.com/new-url.png",
        }),
      );
    });
  });
});
