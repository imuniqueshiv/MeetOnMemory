import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TestimonialsSection from "../../TestimonialsSection.jsx";
import TestimonialsCarousel from "../TestimonialsCarousel.jsx";
import StarRating from "../StarRating.jsx";

vi.mock("../../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
  },
}));

import apiClient from "../../../services/apiClient.js";

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const sample = [
  {
    id: "1",
    rating: 5,
    comment: "MeetOnMemory made tracking decisions easy for our team.",
    user: { name: "John Doe", profilePic: "", role: "member" },
    organization: { name: "Engineering Team" },
  },
  {
    id: "2",
    rating: 4,
    comment: "Action items finally stay visible after every meeting.",
    user: { name: "Jane Doe", profilePic: "", role: "admin" },
    organization: null,
  },
];

describe("StarRating", () => {
  it("exposes accessible rating value when read-only", () => {
    render(<StarRating value={4} readOnly />);
    expect(screen.getByRole("img", { name: "4 out of 5 stars" })).toBeTruthy();
  });

  it("allows selecting a rating interactively", () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    expect(onChange).toHaveBeenCalledWith(5);
  });
});

describe("TestimonialsCarousel", () => {
  it("shows empty state when there are no testimonials", () => {
    render(<TestimonialsCarousel testimonials={[]} />);
    expect(screen.getByText("No testimonials yet.")).toBeTruthy();
  });

  it("renders comments in quotation marks and supports next navigation", () => {
    render(<TestimonialsCarousel testimonials={sample} />);
    expect(
      screen.getByText((text) =>
        text.includes(
          "MeetOnMemory made tracking decisions easy for our team.",
        ),
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Next testimonials"));
    expect(screen.getByLabelText("Previous testimonials")).toBeTruthy();
  });

  it("toggles play and pause", () => {
    render(<TestimonialsCarousel testimonials={sample} />);
    const pause = screen.getByLabelText("Pause carousel");
    fireEvent.click(pause);
    expect(screen.getByLabelText("Play carousel")).toBeTruthy();
  });
});

describe("TestimonialsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads testimonials from the API", async () => {
    apiClient.get.mockResolvedValue({
      data: { testimonials: sample, pagination: { total: 2 } },
    });

    render(
      <MemoryRouter>
        <TestimonialsSection />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/testimonials/spotlight",
        {
          params: { limit: 12 },
        },
      );
    });

    expect(await screen.findByText("Share Your Experience")).toBeTruthy();
    expect(
      await screen.findByText((text) =>
        text.includes(
          "MeetOnMemory made tracking decisions easy for our team.",
        ),
      ),
    ).toBeTruthy();
  });

  it("shows empty messaging when API returns no testimonials", async () => {
    apiClient.get.mockResolvedValue({
      data: { testimonials: [], pagination: { total: 0 } },
    });

    render(
      <MemoryRouter>
        <TestimonialsSection />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No testimonials yet.")).toBeTruthy();
  });

  it("shows an error state when the API fails", async () => {
    apiClient.get.mockRejectedValue(new Error("network"));

    render(
      <MemoryRouter>
        <TestimonialsSection />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Unable to load testimonials right now."),
    ).toBeTruthy();
  });
});
