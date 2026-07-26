import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminPanel from "../AdminPanel";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

describe("AdminPanel", () => {
  it("renders the admin panel title and overview module", () => {
    render(
      <MemoryRouter>
        <AdminPanel />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getAllByText("adminPanel.title").length).toBeGreaterThan(0);
    expect(screen.getAllByText("adminPanel.overview").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("adminPanel.recentActivity")).toBeInTheDocument();
  });
});
