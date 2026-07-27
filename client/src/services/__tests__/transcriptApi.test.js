import { describe, expect, it, vi } from "vitest";
import { transcriptApi } from "../transcriptApi.js";
import apiClient from "../apiClient.js";

vi.mock("../apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe("transcriptApi", () => {
  it("getTranscriptByMeetingId calls apiClient.get with correct URL", async () => {
    apiClient.get.mockResolvedValue({ data: { id: "t1" } });

    const res = await transcriptApi.getTranscriptByMeetingId("m123");

    expect(apiClient.get).toHaveBeenCalledWith("/api/transcripts/meeting/m123");
    expect(res).toEqual({ data: { id: "t1" } });
  });

  it("updateSpeaker calls apiClient.put with correct URL and data", async () => {
    const postData = { oldSpeaker: "A", newSpeaker: "B" };
    apiClient.put.mockResolvedValue({ data: { success: true } });

    const res = await transcriptApi.updateSpeaker("t123", postData);

    expect(apiClient.put).toHaveBeenCalledWith(
      "/api/transcripts/t123/speakers",
      postData
    );
    expect(res).toEqual({ data: { success: true } });
  });

  it("searchTranscript calls apiClient.post with correct URL and query", async () => {
    apiClient.post.mockResolvedValue({ data: { matches: [] } });

    const res = await transcriptApi.searchTranscript("m123", "hello");

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/transcripts/meeting/m123/search",
      { query: "hello" }
    );
    expect(res).toEqual({ data: { matches: [] } });
  });

  it("exportText calls apiClient.get with correct URL and responseType", async () => {
    apiClient.get.mockResolvedValue({ data: {} });

    await transcriptApi.exportText("m123");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/transcripts/meeting/m123/export/text",
      { responseType: "blob" }
    );
  });

  it("exportPDF calls apiClient.get with correct URL and responseType", async () => {
    apiClient.get.mockResolvedValue({ data: {} });

    await transcriptApi.exportPDF("m123");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/transcripts/meeting/m123/export/pdf",
      { responseType: "blob" }
    );
  });
});
