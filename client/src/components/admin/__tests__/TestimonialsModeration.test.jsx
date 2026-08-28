import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TestimonialsModeration from "../TestimonialsModeration.jsx";
import apiClient from "../../../services/apiClient.js";

vi.mock("../../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("TestimonialsModeration (#2266)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockResolvedValue({
      data: {
        testimonials: [
          {
            id: "t1",
            rating: 5,
            comment: "Pending review content here",
            status: "pending",
            user: { name: "Ada" },
            organization: null,
            createdAt: "2026-08-01T00:00:00.000Z",
            featuredOnHomepage: false,
            spotlightOrder: 0,
          },
          {
            id: "t2",
            rating: 4,
            comment: "Another pending review content",
            status: "pending",
            user: { name: "Grace" },
            organization: null,
            createdAt: "2026-08-02T00:00:00.000Z",
            featuredOnHomepage: false,
            spotlightOrder: 0,
          },
        ],
      },
    });
    apiClient.post.mockResolvedValue({
      data: { success: true, message: "Marked 2 testimonial(s) as approved" },
    });
  });

  it("sends bulk approve for selected rows", async () => {
    render(<TestimonialsModeration />);

    expect(
      await screen.findByText(/Pending review content here/i),
    ).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Select all testimonials"));
    fireEvent.click(screen.getByRole("button", { name: /Bulk approve/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/admin/testimonials/bulk",
        {
          ids: ["t1", "t2"],
          action: "approve",
        },
      );
    });
  });
});
