import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VenueMapPreview from "../VenueMapPreview";
import * as geocodeService from "../../../services/geocodeService";

describe("VenueMapPreview component (#2256)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when venue is empty and no coordinates are provided", () => {
    const { container } = render(
      <VenueMapPreview venue="" coordinates={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders virtual meeting banner when venue is an online meeting link", () => {
    render(
      <VenueMapPreview
        venue="https://zoom.us/j/1234567890"
        coordinates={null}
      />,
    );

    expect(screen.getByText(/Online \/ Virtual Venue/i)).toBeInTheDocument();
    expect(
      screen.getByText("https://zoom.us/j/1234567890"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Join Meeting/i })).toHaveAttribute(
      "href",
      "https://zoom.us/j/1234567890",
    );
  });

  it("renders map embed iframe when coordinates are provided", () => {
    render(
      <VenueMapPreview
        venue="1600 Amphitheatre Pkwy, Mountain View, CA"
        coordinates={{ lat: 37.422, lng: -122.084 }}
      />,
    );

    expect(
      screen.getByText("1600 Amphitheatre Pkwy, Mountain View, CA"),
    ).toBeInTheDocument();
    const iframe = screen.getByTitle(
      /Venue map preview for 1600 Amphitheatre Pkwy/i,
    );
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "src",
      expect.stringContaining("openstreetmap.org/export/embed.html"),
    );
  });

  it("renders external map links for Google Maps and OpenStreetMap", () => {
    render(
      <VenueMapPreview
        venue="Times Square, New York"
        coordinates={{ lat: 40.758, lng: -73.9855 }}
      />,
    );

    const googleLink = screen.getByRole("link", { name: /Google Maps/i });
    expect(googleLink).toHaveAttribute(
      "href",
      expect.stringContaining(
        "google.com/maps/search/?api=1&query=40.758,-73.9855",
      ),
    );

    const osmLink = screen.getByRole("link", { name: /OSM/i });
    expect(osmLink).toHaveAttribute(
      "href",
      expect.stringContaining("openstreetmap.org/?mlat=40.758&mlon=-73.9855"),
    );
  });

  it("geocodes physical address and renders map once resolved", async () => {
    vi.spyOn(geocodeService, "geocodeVenue").mockResolvedValue({
      lat: 51.5074,
      lng: -0.1278,
      displayName: "London, UK",
      isVirtual: false,
    });

    const onResolved = vi.fn();
    render(
      <VenueMapPreview
        venue="London, UK"
        coordinates={null}
        onCoordinatesResolved={onResolved}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByTitle(/Venue map preview for London, UK/i),
      ).toBeInTheDocument();
    });

    expect(onResolved).toHaveBeenCalledWith({
      lat: 51.5074,
      lng: -0.1278,
    });
  });

  it("renders graceful fallback message when geocoding fails or returns null", async () => {
    vi.spyOn(geocodeService, "geocodeVenue").mockResolvedValue(null);

    render(
      <VenueMapPreview
        venue="Some Non-Existent Address XYZ123"
        coordinates={null}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /Interactive map preview unavailable for this location/i,
        ),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", { name: /Search location on Google Maps/i }),
    ).toBeInTheDocument();
  });

  it("handles copy venue address to clipboard", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <VenueMapPreview
        venue="Empire State Building"
        coordinates={{ lat: 40.7484, lng: -73.9857 }}
      />,
    );

    const copyButton = screen.getByRole("button", {
      name: /Copy venue address/i,
    });
    fireEvent.click(copyButton);

    expect(writeTextMock).toHaveBeenCalledWith("Empire State Building");
  });
});
