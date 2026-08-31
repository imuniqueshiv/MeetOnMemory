import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SemanticGraphExplorer from "../SemanticGraphExplorer.jsx";
import AppContent from "../../context/AppContent";
import { meetingApi } from "../../services";
import {
  extractMeetingSemanticGraph,
  getSemanticNeighborhood,
} from "../../services/semanticGraphApi";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../services", () => ({
  meetingApi: {
    getAllMeetings: vi.fn(),
  },
}));

vi.mock("../../services/semanticGraphApi", () => ({
  extractMeetingSemanticGraph: vi.fn(),
  getSemanticNeighborhood: vi.fn(),
}));

const MEETINGS_PAYLOAD = {
  data: {
    success: true,
    meetings: [
      { _id: "meet-kickoff", title: "Kickoff" },
      { _id: "meet-finance", title: "Finance Sync" },
    ],
  },
};

const MEETING_GRAPH = {
  nodes: [
    { id: "meeting-meet-kickoff", label: "Kickoff", type: "MEETING" },
    { id: "decision-meet-kickoff-0", label: "Adopt Vite", type: "DECISION" },
    {
      id: "action-meet-kickoff-0",
      label: "Migrate build",
      type: "ACTION_ITEM",
    },
    { id: "person-user-alice", label: "Alice", type: "PERSON" },
    { id: "topic-frontend", label: "frontend", type: "TOPIC" },
  ],
  edges: [
    {
      source: "decision-meet-kickoff-0",
      target: "meeting-meet-kickoff",
      relation: "DECIDED_IN",
      confidence: 0.95,
    },
    {
      source: "action-meet-kickoff-0",
      target: "person-user-alice",
      relation: "OWNED_BY",
      confidence: 1,
    },
  ],
};

const NEIGHBORHOOD_GRAPH = {
  nodes: [
    { id: "person-user-alice", label: "Alice", type: "PERSON" },
    {
      id: "action-meet-finance-2",
      label: "Send budget draft",
      type: "ACTION_ITEM",
    },
  ],
  edges: [
    {
      source: "action-meet-finance-2",
      target: "person-user-alice",
      relation: "OWNED_BY",
      confidence: 1,
    },
  ],
};

const userData = {
  _id: "user-1",
  role: "member",
  organization: { _id: "org-1", name: "Acme" },
};

const renderPage = (user = userData, { loading = false } = {}) =>
  render(
    <MemoryRouter>
      <AppContent.Provider value={{ userData: user, loading }}>
        <SemanticGraphExplorer />
      </AppContent.Provider>
    </MemoryRouter>,
  );

const selectKickoff = async () => {
  const select = await screen.findByLabelText("Select a meeting to extract");
  fireEvent.change(select, { target: { value: "meet-kickoff" } });
  return select;
};

describe("SemanticGraphExplorer (#2446)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingApi.getAllMeetings.mockResolvedValue(MEETINGS_PAYLOAD);
    extractMeetingSemanticGraph.mockResolvedValue(MEETING_GRAPH);
    getSemanticNeighborhood.mockResolvedValue(NEIGHBORHOOD_GRAPH);
  });

  it("extracts and renders the semantic graph for the selected meeting", async () => {
    renderPage();

    expect(
      screen.getByText("Select a meeting to extract its semantic graph."),
    ).toBeInTheDocument();

    await selectKickoff();

    await waitFor(() => {
      expect(extractMeetingSemanticGraph).toHaveBeenCalledWith("meet-kickoff");
    });

    expect(
      await screen.findByText("5 entities, 2 relations"),
    ).toBeInTheDocument();
    expect(screen.getByText("Decisions (1)")).toBeInTheDocument();
    expect(screen.getByText("People (1)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Adopt Vite" }),
    ).toBeInTheDocument();
    expect(screen.getByText("DECIDED_IN")).toBeInTheDocument();
  });

  it("filters entities by the search query", async () => {
    renderPage();
    await selectKickoff();
    await screen.findByRole("button", { name: "Adopt Vite" });

    fireEvent.change(screen.getByLabelText("Search entities"), {
      target: { value: "alice" },
    });

    expect(
      await screen.findByText("1 entities, 0 relations"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Adopt Vite" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alice" })).toBeInTheDocument();
  });

  it("links a selected entity to its source meeting", async () => {
    renderPage();
    await selectKickoff();

    fireEvent.click(await screen.findByRole("button", { name: "Adopt Vite" }));

    const link = screen.getByRole("link", { name: /Open source meeting/i });
    expect(link).toHaveAttribute("href", "/meetings/meet-kickoff");
  });

  it("expands the neighborhood of a selected entity at the chosen hop count", async () => {
    renderPage();
    await selectKickoff();

    fireEvent.change(screen.getByLabelText("Neighborhood hops"), {
      target: { value: "2" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Alice" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Expand neighborhood/i }),
    );

    await waitFor(() => {
      expect(getSemanticNeighborhood).toHaveBeenCalledWith(
        "person-user-alice",
        2,
      );
    });

    expect(
      await screen.findByText(/Showing the 2-hop neighborhood of/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send budget draft" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Back to meeting graph/i }),
    );

    expect(
      await screen.findByRole("button", { name: "Adopt Vite" }),
    ).toBeInTheDocument();
  });

  it("surfaces extraction failures", async () => {
    extractMeetingSemanticGraph.mockRejectedValueOnce({
      response: { data: { error: "Meeting not found" } },
    });

    renderPage();
    await selectKickoff();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Meeting not found",
    );
  });

  it("prompts for an organization when the user has none", async () => {
    renderPage({ ...userData, organization: null });

    expect(await screen.findByText("No Organizations Yet")).toBeInTheDocument();
    expect(meetingApi.getAllMeetings).not.toHaveBeenCalled();
  });
});
