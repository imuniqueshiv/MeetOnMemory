import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { MemoryRouter } from "react-router-dom";
import SlackConnectPanel from "../SlackConnectPanel.jsx";
import * as slackHook from "../../../hooks/useSlackIntegration.js";

vi.mock("../../../hooks/useSlackIntegration.js");

describe("SlackConnectPanel (#2007)", () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const mockUpdateChannel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders unconnected state with Connect button", () => {
    vi.spyOn(slackHook, "default").mockReturnValue({
      isConnected: false,
      teamName: "",
      teamId: "",
      channelId: "",
      installedAt: null,
      loading: false,
      saving: false,
      error: null,
      connectSlack: mockConnect,
      disconnectSlack: mockDisconnect,
      updateChannel: mockUpdateChannel,
    });

    render(
      <MemoryRouter>
        <SlackConnectPanel organizationId="org-123" canEdit={true} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Slack Workspace Integration")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Connect Slack/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Connect Slack/i }));
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("renders connected state with workspace details, channel config and Disconnect button", async () => {
    vi.spyOn(slackHook, "default").mockReturnValue({
      isConnected: true,
      teamName: "Acme Corp",
      teamId: "T12345",
      channelId: "C999",
      installedAt: new Date("2026-01-01").toISOString(),
      loading: false,
      saving: false,
      error: null,
      connectSlack: mockConnect,
      disconnectSlack: mockDisconnect,
      updateChannel: mockUpdateChannel,
    });

    render(
      <MemoryRouter>
        <SlackConnectPanel organizationId="org-123" canEdit={true} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/i)).toBeInTheDocument();
    expect(screen.getByText("(T12345)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Disconnect/i }),
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText("e.g. C012345678 or #general");
    expect(input).toHaveValue("C999");

    fireEvent.change(input, { target: { value: "C888" } });
    const saveButton = screen.getByRole("button", { name: /Save/i });
    fireEvent.click(saveButton);

    expect(mockUpdateChannel).toHaveBeenCalledWith("C888");

    fireEvent.click(screen.getByRole("button", { name: /Disconnect/i }));
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it("disables actions when canEdit is false", () => {
    vi.spyOn(slackHook, "default").mockReturnValue({
      isConnected: false,
      teamName: "",
      teamId: "",
      channelId: "",
      installedAt: null,
      loading: false,
      saving: false,
      error: null,
      connectSlack: mockConnect,
      disconnectSlack: mockDisconnect,
      updateChannel: mockUpdateChannel,
    });

    render(
      <MemoryRouter>
        <SlackConnectPanel organizationId="org-123" canEdit={false} />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: /Connect Slack/i });
    expect(button).toBeDisabled();
  });
});
