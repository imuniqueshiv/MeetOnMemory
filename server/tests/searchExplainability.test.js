import { buildSearchExplainability } from "../utils/searchExplainability.js";

describe("searchExplainability", () => {
  const meeting = {
    _id: "meeting-1",
    title: "Quarterly Finance Review",
    description: "Review of budget and spending targets.",
    summary: "The team discussed the Q3 finance budget.",
    meetingType: "internal",
    tags: ["finance", "budget"],
    participants: [{ name: "Asha" }, { name: "Ravi" }],
    transcript:
      "Ravi presented the Q3 budget and the team agreed to reduce spending.",
    structuredMoM: {
      topics: ["Q3 budget", "Hiring"],
      decisions: ["Reduce spending"],
      action_items: ["Publish the updated budget"],
    },
    isTranscriptEncrypted: false,
    encryptedTranscript: null,
  };

  it("distinguishes exact and semantic evidence", () => {
    const result = buildSearchExplainability({
      query: "budget",
      meeting,
      similarityScore: 0.91,
      vectorRank: 2,
      meetingId: "meeting-1",
    });

    expect(result.matchModes).toEqual(["exact", "semantic"]);
    expect(result.semantic.score).toBeCloseTo(0.91);
    expect(result.semantic.vectorRank).toBe(2);
    expect(result.exactMatches.some((item) => item.field === "title")).toBe(
      true,
    );
    expect(result.metadataMatches.some((item) => item.field === "tags")).toBe(
      true,
    );
    expect(result.transcriptSnippets).toHaveLength(1);
    expect(result.evidenceUrl).toContain("/meeting/meeting-1");
  });

  it("captures matching topics, decisions, and participants", () => {
    const result = buildSearchExplainability({
      query: "Ravi spending",
      meeting,
      similarityScore: 0.5,
    });

    expect(
      result.metadataMatches.some((item) => item.field === "participants"),
    ).toBe(true);
    expect(
      result.metadataMatches.some((item) => item.field === "decisions"),
    ).toBe(true);
  });

  it("does not expose plaintext transcript from encrypted meetings", () => {
    const result = buildSearchExplainability({
      query: "budget",
      meeting: {
        ...meeting,
        transcript: "Secret budget discussion",
        isTranscriptEncrypted: true,
      },
      similarityScore: 0.8,
    });

    expect(result.transcriptSnippets).toEqual([]);
    expect(result.privacy.encryptedTranscriptExcluded).toBe(true);
    expect(result.evidence.some((item) => item.kind === "transcript")).toBe(
      false,
    );
  });

  it("returns semantic-only mode when no exact evidence exists", () => {
    const result = buildSearchExplainability({
      query: "quantum",
      meeting,
      similarityScore: 0.72,
    });

    expect(result.matchModes).toEqual(["semantic"]);
    expect(result.exactMatches).toEqual([]);
    expect(result.transcriptSnippets).toEqual([]);
  });
});
