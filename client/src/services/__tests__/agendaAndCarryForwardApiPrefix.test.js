import { describe, expect, it, vi, beforeEach } from "vitest";
import carryForwardApi from "../carryForwardApi.js";
import * as agendaBuilderApi from "../agendaBuilderApi.js";
import * as agendaVoteApi from "../../api/agendaVoteApi.js";
import * as agendaSuggestionApi from "../agendaSuggestionApi.js";
import apiClient from "../apiClient.js";
import { assertAllCallsUseApiPrefix } from "./helpers/apiPrefixAssertionHelper.js";

vi.mock("../apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Agenda & Carry-Forward API Prefix Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("carryForwardApi", () => {
    it("prefixes all endpoints with /api", async () => {
      apiClient.get.mockResolvedValue({ data: { success: true } });
      apiClient.put.mockResolvedValue({ data: { success: true } });
      apiClient.post.mockResolvedValue({ data: { success: true } });

      await carryForwardApi.getConfig("s-1");
      await carryForwardApi.updateConfig("s-1", []);
      await carryForwardApi.getPreview("s-1");
      await carryForwardApi.applyCarryForward("s-1", "m-1");
      await carryForwardApi.getMeetingPreview("m-1");
      await carryForwardApi.applyMeetingCarryForward("m-1", "s-1");
      await carryForwardApi.getHistory("s-1");

      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/meeting-series/s-1/carry-forward/config",
      );
      expect(apiClient.put).toHaveBeenCalledWith(
        "/api/meeting-series/s-1/carry-forward/config",
        { carryForwardRules: [] },
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/meeting-series/s-1/carry-forward/preview",
      );
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/meeting-series/s-1/carry-forward/apply",
        { currentMeetingId: "m-1" },
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/meetings/m-1/carry-forward/preview",
      );
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/meetings/m-1/carry-forward/apply",
        { seriesId: "s-1" },
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/series/s-1/carry-forward/history",
      );

      assertAllCallsUseApiPrefix(apiClient);
    });
  });

  describe("agendaBuilderApi", () => {
    it("prefixes all endpoints with /api", async () => {
      apiClient.get.mockResolvedValue({ data: [] });
      apiClient.post.mockResolvedValue({ data: {} });
      apiClient.put.mockResolvedValue({ data: {} });

      await agendaBuilderApi.getProposals("m-1");
      await agendaBuilderApi.createProposal("m-1", { title: "Topic" });
      await agendaBuilderApi.voteProposal("m-1", "p-1", 1);
      await agendaBuilderApi.updateProposalStatus("m-1", "p-1", "approved");
      await agendaBuilderApi.reorderProposals("m-1", ["p-1"]);
      await agendaBuilderApi.generateAiProposals("m-1", {});
      await agendaBuilderApi.finalizeAgenda("m-1");

      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/meetings/m-1/agenda-builder/proposals",
      );
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/meetings/m-1/agenda-builder/proposals",
        { title: "Topic" },
      );
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/meetings/m-1/agenda-builder/proposals/p-1/vote",
        { voteValue: 1 },
      );
      expect(apiClient.put).toHaveBeenCalledWith(
        "/api/meetings/m-1/agenda-builder/proposals/p-1/status",
        { status: "approved" },
      );
      expect(apiClient.put).toHaveBeenCalledWith(
        "/api/meetings/m-1/agenda-builder/proposals/reorder",
        { orderedIds: ["p-1"] },
      );
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/meetings/m-1/agenda-builder/ai-suggest",
        { contextData: {} },
      );
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/meetings/m-1/agenda-builder/finalize",
      );

      assertAllCallsUseApiPrefix(apiClient);
    });
  });

  describe("agendaVoteApi", () => {
    it("prefixes all endpoints with /api", async () => {
      apiClient.get.mockResolvedValue({ data: { tally: {} } });
      apiClient.post.mockResolvedValue({ data: { success: true } });
      apiClient.delete.mockResolvedValue({ data: { success: true } });

      await agendaVoteApi.getVoteTally("m-1");
      await agendaVoteApi.castVote("m-1", "item-1", 1);
      await agendaVoteApi.removeVote("m-1", "item-1");
      await agendaVoteApi.autoSortAgenda("m-1");

      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/meetings/m-1/agenda-votes",
      );
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/meetings/m-1/agenda-votes/item-1",
        { vote: 1 },
      );
      expect(apiClient.delete).toHaveBeenCalledWith(
        "/api/meetings/m-1/agenda-votes/item-1",
      );
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/meetings/m-1/agenda-votes/auto-sort",
      );

      assertAllCallsUseApiPrefix(apiClient);
    });
  });

  describe("agendaSuggestionApi", () => {
    it("prefixes all endpoints with /api", async () => {
      apiClient.get.mockResolvedValue({ data: [] });
      apiClient.post.mockResolvedValue({ data: {} });
      apiClient.put.mockResolvedValue({ data: {} });

      await agendaSuggestionApi.generateAgendaSuggestions("org-1", "m-1");
      await agendaSuggestionApi.updateSuggestionItemStatus(
        "s-1",
        "i-1",
        "accepted",
        "Text",
      );
      await agendaSuggestionApi.applySuggestionToMeeting("s-1", "m-1");
      await agendaSuggestionApi.getMeetingSuggestions("m-1");

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/agenda-suggestions/generate",
        { organizationId: "org-1", meetingId: "m-1" },
      );
      expect(apiClient.put).toHaveBeenCalledWith(
        "/api/agenda-suggestions/s-1/item/i-1",
        { status: "accepted", acceptedText: "Text" },
      );
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/agenda-suggestions/s-1/apply",
        { meetingId: "m-1" },
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/agenda-suggestions/meeting/m-1",
      );

      assertAllCallsUseApiPrefix(apiClient);
    });
  });
});
