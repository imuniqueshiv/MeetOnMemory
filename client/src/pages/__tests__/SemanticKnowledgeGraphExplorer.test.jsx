import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SemanticKnowledgeGraphExplorer from "../SemanticKnowledgeGraphExplorer";
import * as semanticApi from "../../services/semanticKnowledgeGraphApi";
import * as meetingApiModule from "../../services/meetingApi";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../services/semanticKnowledgeGraphApi", () => ({
  semanticKnowledgeGraphApi: {
    extractSemanticGraph: vi.fn(),
    getSemanticNeighborhood: vi.fn(),
  },
}));

vi.mock("../../services/meetingApi", () => ({
  meetingApi: {
    getMeetings: vi.fn(),
  },
}));

describe("SemanticKnowledgeGraphExplorer (#2446)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockGraph = {
    nodes: [
      { id: "meeting-m1", label: "Sprint Planning", type: "MEETING" },
      { id: "decision-m1-0", label: "Use GraphQL", type: "DECISION" },
      { id: "person-u1", label: "Alice Engineer", type: "PERSON" },
    ],
    edges: [
      {
        source: "decision-m1-0",
        target: "meeting-m1",
        relation: "DECIDED_IN",
        confidence: 0.95,
      },
    ],
  };

  it("loads and renders semantic graph entities and relationship tags", async () => {
    meetingApiModule.meetingApi.getMeetings.mockResolvedValue({
      data: { meetings: [{ _id: "m1", title: "Sprint Planning" }] },
    });
    semanticApi.semanticKnowledgeGraphApi.extractSemanticGraph.mockResolvedValue(
      {
        data: { graph: mockGraph },
      },
    );

    render(
      <MemoryRouter initialEntries={["/semantic-knowledge-graph?meetingId=m1"]}>
        <SemanticKnowledgeGraphExplorer />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Use GraphQL")).toBeInTheDocument();
    });

    expect(screen.getByText("Alice Engineer")).toBeInTheDocument();
  });

  it("expands neighborhood when an entity is inspected and expanded", async () => {
    meetingApiModule.meetingApi.getMeetings.mockResolvedValue({
      data: { meetings: [{ _id: "m1", title: "Sprint Planning" }] },
    });
    semanticApi.semanticKnowledgeGraphApi.extractSemanticGraph.mockResolvedValue(
      {
        data: { graph: mockGraph },
      },
    );
    semanticApi.semanticKnowledgeGraphApi.getSemanticNeighborhood.mockResolvedValue(
      {
        data: {
          nodes: [
            ...mockGraph.nodes,
            { id: "topic-infra", label: "Infrastructure", type: "TOPIC" },
          ],
          edges: mockGraph.edges,
        },
      },
    );

    render(
      <MemoryRouter initialEntries={["/semantic-knowledge-graph?meetingId=m1"]}>
        <SemanticKnowledgeGraphExplorer />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Use GraphQL")).toBeInTheDocument();
    });

    const decisionNode = screen.getByText("Use GraphQL");
    fireEvent.click(decisionNode);

    expect(screen.getByText("Entity Inspector")).toBeInTheDocument();
    expect(screen.getByText("Node ID: decision-m1-0")).toBeInTheDocument();

    const expandButton = screen.getByRole("button", {
      name: /Expand 1-Hop Neighborhood/i,
    });
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(
        semanticApi.semanticKnowledgeGraphApi.getSemanticNeighborhood,
      ).toHaveBeenCalledWith("decision-m1-0", 1);
    });
  });
});
