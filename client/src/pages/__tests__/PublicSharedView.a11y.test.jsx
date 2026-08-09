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
});
