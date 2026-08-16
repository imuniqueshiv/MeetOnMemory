import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TemplateLibrary from "../TemplateLibrary.jsx";
import {
  browseTemplates,
  cloneTemplate,
  rateTemplate,
} from "../../services/templateLibraryApi";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <nav>Navbar</nav>,
}));

vi.mock("lucide-react", () => ({
  CopyPlus: () => <span />,
  Star: () => <span />,
  ChevronDown: () => <span />,
  Filter: () => <span />,
}));

vi.mock("../../services/templateLibraryApi", () => ({
  browseTemplates: vi.fn(),
  cloneTemplate: vi.fn(),
  rateTemplate: vi.fn(),
}));

const template = {
  _id: "template-1",
  name: "Weekly Sync",
  category: "Engineering",
  description: "A weekly engineering sync",
  cloneCount: 3,
  averageRating: 4.5,
  agendaBlocks: [{ title: "Updates", duration: 15 }],
};

const otherTemplate = {
  ...template,
  _id: "template-2",
  name: "Planning Session",
};

describe("TemplateLibrary duplicate-submission protection (#1525)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browseTemplates.mockResolvedValue({
      templates: [template, otherTemplate],
    });
    cloneTemplate.mockResolvedValue({});
    rateTemplate.mockResolvedValue({});
  });

  it("disables only the active clone operation while it is pending", async () => {
    let resolveClone;
    cloneTemplate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClone = resolve;
        }),
    );

    render(
      <MemoryRouter>
        <TemplateLibrary />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Weekly Sync")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Weekly Sync"));

    const cloneButton = screen.getByRole("button", { name: "Clone Template" });
    fireEvent.click(cloneButton);

    expect(screen.getByRole("button", { name: "Cloning..." })).toBeDisabled();
    expect(cloneTemplate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cloning..." }));
    expect(cloneTemplate).toHaveBeenCalledTimes(1);

    resolveClone({});
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Clone Template" }),
      ).toBeEnabled();
    });
  });

  it("restores clone interaction after a failed request", async () => {
    let rejectClone;
    cloneTemplate.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectClone = reject;
        }),
    );

    render(
      <MemoryRouter>
        <TemplateLibrary />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Weekly Sync")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Weekly Sync"));
    fireEvent.click(screen.getByRole("button", { name: "Clone Template" }));

    expect(screen.getByRole("button", { name: "Cloning..." })).toBeDisabled();

    rejectClone(new Error("clone failed"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Clone Template" }),
      ).toBeEnabled();
    });
  });

  it("prevents duplicate rating submissions while the request is pending", async () => {
    let resolveRating;
    rateTemplate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRating = resolve;
        }),
    );

    render(
      <MemoryRouter>
        <TemplateLibrary />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Weekly Sync")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Weekly Sync"));

    const submitButton = screen.getByRole("button", { name: "Submit Rating" });
    fireEvent.click(submitButton);

    expect(
      screen.getByRole("button", { name: "Submitting..." }),
    ).toBeDisabled();
    expect(rateTemplate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Submitting..." }));
    expect(rateTemplate).toHaveBeenCalledTimes(1);

    resolveRating({});
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Submitting..." }),
      ).not.toBeInTheDocument();
    });
  });

  it("restores rating interaction after a failed request", async () => {
    let rejectRating;
    rateTemplate.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectRating = reject;
        }),
    );

    render(
      <MemoryRouter>
        <TemplateLibrary />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Weekly Sync")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Weekly Sync"));
    fireEvent.click(screen.getByRole("button", { name: "Submit Rating" }));

    expect(
      screen.getByRole("button", { name: "Submitting..." }),
    ).toBeDisabled();

    rejectRating(new Error("rating failed"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Submit Rating" }),
      ).toBeEnabled();
    });
  });
});
