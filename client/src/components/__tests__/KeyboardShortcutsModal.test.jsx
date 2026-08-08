import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import KeyboardShortcutsModal from "../KeyboardShortcutsModal.jsx";
import Footer from "../Footer.jsx";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../context/ThemeContext.jsx";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key, fallback) => fallback || key }),
}));

describe("ARIA Landmarks & Keyboard Shortcuts Dialog (#1307)", () => {
  it("renders Footer with role=contentinfo", () => {
    const { container } = render(
      <MemoryRouter>
        <ThemeProvider>
          <Footer />
        </ThemeProvider>
      </MemoryRouter>,
    );

    const footer = container.querySelector("footer");
    expect(footer).toHaveAttribute("role", "contentinfo");
  });

  it("exposes WAI-ARIA dialog attributes when open", () => {
    render(<KeyboardShortcutsModal isOpen={true} onClose={() => {}} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
  });

  it("closes modal on Escape key press", () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsModal isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
