import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LanguageSwitcher from "../LanguageSwitcher";

// Mock react-i18next
const mockChangeLanguage = vi.fn();
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: {
      language: "en",
      changeLanguage: mockChangeLanguage,
    },
  }),
}));

describe("LanguageSwitcher", () => {
  it("renders correctly with current language", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByText("EN")).toBeInTheDocument();
  });

  it("opens dropdown when clicked", () => {
    render(<LanguageSwitcher />);
    const button = screen.getByRole("button", {
      name: "language.switchLanguage",
    });
    fireEvent.click(button);

    // Check if dropdown options are visible
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("हिंदी")).toBeInTheDocument();
    expect(screen.getByText("العربية")).toBeInTheDocument();
  });

  it("calls changeLanguage when Hindi is selected", () => {
    render(<LanguageSwitcher />);

    // Open dropdown
    fireEvent.click(
      screen.getByRole("button", { name: "language.switchLanguage" }),
    );

    // Click on Hindi
    fireEvent.click(screen.getByText("हिंदी"));

    expect(mockChangeLanguage).toHaveBeenCalledWith("hi");
  });

  it("calls changeLanguage when Arabic is selected", () => {
    render(<LanguageSwitcher />);

    // Open dropdown
    fireEvent.click(
      screen.getByRole("button", { name: "language.switchLanguage" }),
    );

    // Click on Arabic
    fireEvent.click(screen.getByText("العربية"));

    expect(mockChangeLanguage).toHaveBeenCalledWith("ar");
  });
});
