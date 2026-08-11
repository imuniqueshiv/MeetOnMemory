import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DigestPreferences from "../DigestPreferences.jsx";
import apiClient from "../../services/apiClient.js";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    update: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe("DigestPreferences HTML Sanitization (#1339)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sanitizes preview HTML returned from preview API before rendering", async () => {
    apiClient.get.mockResolvedValue({
      data: {
        frequency: "weekly",
        deliveryDay: "Monday",
        deliveryHour: 9,
        includeSections: ["summaries"],
      },
    });

    apiClient.post.mockResolvedValue({
      data: {
        html: `<div><h3>Meeting Summary</h3><script>alert("xss")</script><img src="x" onerror="alert(1)"></div>`,
      },
    });

    render(<DigestPreferences />);

    await waitFor(() => {
      expect(screen.getByText("Meeting Summary")).toBeInTheDocument();
    });

    expect(screen.queryByText(/alert\("xss"\)/i)).not.toBeInTheDocument();
  });
});
