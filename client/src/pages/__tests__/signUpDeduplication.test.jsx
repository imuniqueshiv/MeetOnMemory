import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SignUpPage from "../SignUp";
import AppContent from "../../context/AppContent";

const mockSignUp = {
  create: vi.fn(),
  prepareEmailAddressVerification: vi.fn(),
  attemptEmailAddressVerification: vi.fn(),
};

vi.mock("@clerk/clerk-react", () => ({
  useSignUp: () => ({
    isLoaded: true,
    signUp: mockSignUp,
    setActive: vi.fn().mockResolvedValue(true),
  }),
  useAuth: () => ({
    isSignedIn: false,
    isLoaded: true,
    getToken: vi.fn(),
  }),
  useClerk: () => ({
    signOut: vi.fn(),
  }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("SignUp Page OTP Deduplication (#1097)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sign up form inputs", () => {
    render(
      <MemoryRouter>
        <AppContent.Provider value={{ isLoggedin: false, loading: false }}>
          <SignUpPage />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByPlaceholderText(/John Doe/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
  });

  it("triggers exactly one signUp.create and prepareEmailAddressVerification on submission", async () => {
    mockSignUp.create.mockResolvedValue({ status: "missing_requirements" });
    mockSignUp.prepareEmailAddressVerification.mockResolvedValue({});

    render(
      <MemoryRouter>
        <AppContent.Provider value={{ isLoggedin: false, loading: false }}>
          <SignUpPage />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/John Doe/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "SecretPassword123!" },
    });

    const submitBtn = screen.getByRole("button", { name: /Continue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSignUp.create).toHaveBeenCalledTimes(1);
      expect(mockSignUp.prepareEmailAddressVerification).toHaveBeenCalledTimes(
        1,
      );
    });

    expect(mockSignUp.create).toHaveBeenCalledWith({
      emailAddress: "test@example.com",
      password: "SecretPassword123!",
      firstName: "Test",
      lastName: "User",
    });
  });
});
