import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Glossary from "../Glossary.jsx";
import * as api from "../../services/glossaryApi.js";

vi.mock("../../services/glossaryApi.js", () => ({
  fetchTerms: vi.fn(),
  createTerm: vi.fn(),
  deleteTerm: vi.fn(),
  approveTerm: vi.fn(),
}));

describe("Glossary Dark Mode (#1492)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders container with dark mode CSS utility classes", async () => {
    api.fetchTerms.mockResolvedValue([
      {
        _id: "term-1",
        term: "ROI",
        definition: "Return on Investment",
        approvalStatus: "approved",
      },
    ]);

    const { container } = render(<Glossary />);

    await waitFor(() => {
      expect(screen.getByText("ROI")).toBeInTheDocument();
    });

    const rootContainer = container.firstChild;
    expect(rootContainer).toHaveClass("dark:bg-gray-900");
    expect(rootContainer).toHaveClass("dark:text-gray-100");
  });
});
