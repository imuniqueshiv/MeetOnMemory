import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AccessDenied from "../AccessDenied";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => {
      const map = {
        "accessDenied.code": "403",
        "accessDenied.title": "Access Denied",
        "accessDenied.description":
          "You do not have the required permissions to access this page.",
        "accessDenied.goBack": "Go Back",
        "accessDenied.returnDashboard": "Return to Dashboard",
      };
      return map[key] || key;
    },
  }),
}));

describe("AccessDenied", () => {
  it("renders the 403 access denied content", () => {
    render(
      <MemoryRouter>
        <AccessDenied />
      </MemoryRouter>,
    );

    expect(screen.getByText("403")).toBeInTheDocument();
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(screen.getByText("Go Back")).toBeInTheDocument();
    expect(screen.getByText("Return to Dashboard")).toBeInTheDocument();
  });
});
