import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AccessDenied from "../AccessDenied";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

const renderComponent = (props = {}) => {
  return render(
    <MemoryRouter>
      <AccessDenied {...props} />
    </MemoryRouter>,
  );
};

describe("AccessDenied", () => {
  it("renders 403 heading and access denied message", () => {
    renderComponent();
    expect(screen.getByText("403")).toBeInTheDocument();
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
  });

  it("renders a description message", () => {
    renderComponent();
    expect(
      screen.getByText(
        "You do not have the required permissions to access this page. Please contact your administrator if you believe this is a mistake.",
      ),
    ).toBeInTheDocument();
  });

  it("renders both navigation buttons", () => {
    renderComponent();
    expect(screen.getByText("Go Back")).toBeInTheDocument();
    expect(screen.getByText("Return to Dashboard")).toBeInTheDocument();
  });

  it("renders as full page by default", () => {
    const { container } = renderComponent();
    expect(container.firstChild.classList.contains("min-h-screen")).toBe(true);
  });

  it("renders without full page wrapper when fullPage=false", () => {
    const { container } = renderComponent({ fullPage: false });
    expect(container.firstChild.classList.contains("min-h-screen")).toBe(false);
  });
});
