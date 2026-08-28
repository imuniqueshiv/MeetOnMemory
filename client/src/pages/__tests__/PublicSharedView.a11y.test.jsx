import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PublicSharedView from "../PublicSharedView";

vi.mock("../../services", () => ({
  publicSharedApi: {
    getPublicResource: vi.fn(),
    verifyPasscode: vi.fn(),
  },

  savedFilterApi: {
    getSavedFilters: vi.fn().mockResolvedValue({ data: [] }),
    createSavedFilter: vi.fn(),
    deleteSavedFilter: vi.fn(),
  },
}));

import { publicSharedApi } from "../../services";

const renderPasscodeScreen = () =>
  render(
    <MemoryRouter initialEntries={["/shared/abc123"]}>
      <Routes>
        <Route path="/shared/:hash" element={<PublicSharedView />} />
      </Routes>
    </MemoryRouter>,
  );

describe("PublicSharedView passcode accessibility (#1136)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicSharedApi.getPublicResource.mockRejectedValue({
      response: {
        status: 401,
        data: { requiresPasscode: true },
      },
    });
  });

  it("associates a visible label and help text with the passcode field", async () => {
    renderPasscodeScreen();

    const input = await screen.findByLabelText("Passcode");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("id", "shared-link-passcode");
    expect(input).toHaveAttribute("name", "passcode");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autoComplete", "current-password");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAttribute("aria-invalid", "false");

    const help = screen.getByText(
      /Please enter the passcode to view this shared resource/i,
    );
    expect(help).toHaveAttribute("id", "shared-link-passcode-help");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "shared-link-passcode-help",
    );

    expect(
      screen.getByRole("heading", { name: "Protected Resource" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Access Resource/i }),
    ).toBeInTheDocument();
  });

  it("announces validation errors with aria-invalid and role=alert", async () => {
    renderPasscodeScreen();

    const submit = await screen.findByRole("button", {
      name: /Access Resource/i,
    });
    fireEvent.click(submit);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Passcode is required");
    expect(alert).toHaveAttribute("id", "shared-link-passcode-error");

    const input = screen.getByLabelText("Passcode");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(
      "shared-link-passcode-help",
    );
    expect(input.getAttribute("aria-describedby")).toContain(
      "shared-link-passcode-error",
    );
  });

  it("keeps the verification submit flow working", async () => {
    publicSharedApi.verifyPasscode.mockResolvedValue({
      data: { success: true },
    });
    publicSharedApi.getPublicResource
      .mockRejectedValueOnce({
        response: {
          status: 401,
          data: { requiresPasscode: true },
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          resourceType: "Meeting",
          data: {
            title: "Shared Standup",
            description: "Weekly sync",
            date: "2026-08-01T00:00:00.000Z",
            participants: [],
          },
        },
      });

    renderPasscodeScreen();

    const input = await screen.findByLabelText("Passcode");
    fireEvent.change(input, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Access Resource/i }));

    await waitFor(() => {
      expect(publicSharedApi.verifyPasscode).toHaveBeenCalledWith("abc123", {
        passcode: "secret",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Shared Standup")).toBeInTheDocument();
    });
  });

  it("renders venue and map preview on public shared meeting view (#2256)", async () => {
    publicSharedApi.getPublicResource.mockResolvedValueOnce({
      data: {
        success: true,
        resourceType: "Meeting",
        data: {
          title: "Public Product Launch",
          description: "Keynote presentation",
          date: "2026-09-01T10:00:00.000Z",
          time: "10:00",
          location: "Convention Hall",
          venue: "747 Howard St, San Francisco, CA",
          venueCoordinates: { lat: 37.784, lng: -122.401 },
          participants: [],
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/shared/launch123"]}>
        <Routes>
          <Route path="/shared/:hash" element={<PublicSharedView />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Public Product Launch")).toBeInTheDocument();
    });

    expect(
      screen.getByText("747 Howard St, San Francisco, CA"),
    ).toBeInTheDocument();
    expect(
      screen.getByTitle(/Venue map preview for 747 Howard St/i),
    ).toBeInTheDocument();
  });
});
