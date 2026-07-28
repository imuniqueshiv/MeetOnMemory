import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import OrganizationLogo from "../OrganizationLogo.jsx";
import OrganizationBanner from "../OrganizationBanner.jsx";

describe("Organization branding placeholders", () => {
  it("renders logo initial placeholder when src is empty", () => {
    render(<OrganizationLogo src="" name="Acme Corp" size="md" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders logo image when src is provided", () => {
    render(
      <OrganizationLogo
        src="https://cdn.example.com/logo.png"
        name="Acme Corp"
        size="md"
      />,
    );
    const img = screen.getByRole("img", { name: /acme corp logo/i });
    expect(img).toHaveAttribute("src", "https://cdn.example.com/logo.png");
  });

  it("renders banner placeholder label when src is empty", () => {
    render(<OrganizationBanner src="" name="Acme Corp" />);
    expect(
      screen.getByRole("img", { name: /acme corp banner placeholder/i }),
    ).toBeInTheDocument();
  });

  it("renders banner with image when src is provided", () => {
    const { container } = render(
      <OrganizationBanner
        src="https://cdn.example.com/banner.jpg"
        name="Acme Corp"
      />,
    );
    expect(
      screen.getByRole("img", { name: /acme corp banner$/i }),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example.com/banner.jpg",
    );
  });
});
