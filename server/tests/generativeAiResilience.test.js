/**
 * Issue #976 — GenerativeAIService behaviour under provider failure.
 *
 * Kept separate from the existing GenerativeAIService.test.js because these
 * suites need different module-level mocks and different env, and
 * `jest.unstable_mockModule` is resolved once per module registry.
 *
 * Retries are configured down to zero delay via env so the suite doesn't spend
 * real seconds waiting out exponential backoff.
 */

import { jest } from "@jest/globals";

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));

jest.unstable_mockModule("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

const mockLocalSummarizer = jest.fn();
jest.unstable_mockModule("@xenova/transformers", () => ({
  pipeline: jest.fn().mockResolvedValue(mockLocalSummarizer),
  env: { useBrowserCache: false },
}));

process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_MAX_RETRIES = "2";
process.env.GEMINI_RETRY_BASE_DELAY_MS = "1";
process.env.GEMINI_RETRY_MAX_DELAY_MS = "2";
process.env.GEMINI_TIMEOUT_MS = "200";

const { GoogleGenerativeAI } = await import("@google/generative-ai");
const {
  generateMoMDetailed,
  generateMoMWithAI,
  generateSessionCardAI,
  normalizeMoM,
  buildHumanReadableMoM,
  resetGeminiBreaker,
  resetGeminiClient,
  getGeminiBreakerState,
} = await import("../services/GenerativeAIService.js");

/** A complete MoM the model might return. */
const fullMoM = {
  title: "Q3 Planning",
  date: "2026-08-01",
  summary: "We agreed the roadmap.",
  agenda: ["Roadmap"],
  key_discussions: ["Scope"],
  decisions: ["Ship in September"],
  action_items: [{ task: "Draft the plan", owner: "Ada" }],
  questions_raised: [],
  keywords: ["roadmap"],
  attendees: ["Ada"],
  notes: "",
  scheduling_intents: [],
};

const geminiReturns = (payload) => ({
  response: { text: () => JSON.stringify(payload) },
});

beforeEach(() => {
  jest.clearAllMocks();
  resetGeminiBreaker();
  mockLocalSummarizer.mockResolvedValue([
    { summary_text: "Local fallback summary" },
  ]);
});

describe("generateMoMDetailed — happy path", () => {
  it("returns the parsed MoM plus provenance", async () => {
    mockGenerateContent.mockResolvedValueOnce(geminiReturns(fullMoM));

    const { mom, generation } = await generateMoMDetailed(
      "A short transcript.",
      "2026-08-01",
      "Q3 Planning",
    );

    expect(mom).toEqual(fullMoM);
    expect(generation).toMatchObject({
      provider: "gemini",
      degraded: false,
      chunks: 1,
    });
  });

  it("reuses one client across calls instead of rebuilding it per request", async () => {
    // Drop the memoised client so construction is observable from a clean
    // slate. Previously `new GoogleGenerativeAI(...)` ran on every request, at
    // three separate call sites.
    resetGeminiClient();
    mockGenerateContent.mockResolvedValue(geminiReturns(fullMoM));

    await generateMoMDetailed("one", "2026-08-01", "t");
    await generateMoMDetailed("two", "2026-08-01", "t");

    expect(GoogleGenerativeAI).toHaveBeenCalledTimes(1);
    expect(mockGetGenerativeModel).toHaveBeenCalledTimes(2);
  });

  it("extracts JSON embedded in surrounding prose", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () =>
          `Here you go:\n\`\`\`json\n${JSON.stringify(fullMoM)}\n\`\`\``,
      },
    });

    const { mom } = await generateMoMDetailed("t", "2026-08-01", "t");
    expect(mom.decisions).toEqual(["Ship in September"]);
  });
});

describe("generateMoMDetailed — retry behaviour", () => {
  it("retries a 429 and succeeds without falling back", async () => {
    const rateLimited = Object.assign(new Error("[429 Too Many Requests]"), {
      status: 429,
    });

    mockGenerateContent
      .mockRejectedValueOnce(rateLimited)
      .mockResolvedValueOnce(geminiReturns(fullMoM));

    const { mom, generation } = await generateMoMDetailed(
      "transcript",
      "2026-08-01",
      "t",
    );

    // Previously a single 429 dropped straight to the local model and produced
    // a MoM with no decisions and no action items.
    expect(mom.decisions).toEqual(["Ship in September"]);
    expect(generation.degraded).toBe(false);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(mockLocalSummarizer).not.toHaveBeenCalled();
  });

  it("retries a 503 up to the configured limit before falling back", async () => {
    mockGenerateContent.mockRejectedValue(
      Object.assign(new Error("[503 Service Unavailable]"), { status: 503 }),
    );

    const { generation } = await generateMoMDetailed("t", "2026-08-01", "t");

    // GEMINI_MAX_RETRIES=2 → 3 attempts total.
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    expect(generation.degraded).toBe(true);
    expect(generation.provider).toBe("local-distilbart");
  });

  it("does not retry an auth failure", async () => {
    mockGenerateContent.mockRejectedValue(
      Object.assign(new Error("[401 Unauthorized] bad key"), { status: 401 }),
    );

    await generateMoMDetailed("t", "2026-08-01", "t");

    // Retrying a permanent failure only delays the fallback.
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("does not hang when the provider never responds", async () => {
    mockGenerateContent.mockImplementation(() => new Promise(() => {}));

    const { generation } = await generateMoMDetailed("t", "2026-08-01", "t");

    // The bug: with no timeout this promise never settled, and the AI worker
    // (concurrency 1) stalled MoM generation for every organization.
    expect(generation.degraded).toBe(true);
    expect(generation.reason).toBe("gemini_failed");
    expect(generation.errorKind).toBe("timeout");
  }, 15000);
});

describe("generateMoMDetailed — degradation is visible", () => {
  it("flags a fallback MoM with structured provenance", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Gemini API Error"));

    const { mom, generation } = await generateMoMDetailed(
      "x".repeat(5000),
      "2026-08-01",
      "Title",
    );

    expect(generation).toMatchObject({
      provider: "local-distilbart",
      degraded: true,
      reason: "gemini_failed",
      truncated: true,
      inputCharsUsed: 1024,
      inputCharsTotal: 5000,
    });
    // The operator-relevant fact, now queryable rather than buried in prose.
    expect(mom.generation.truncated).toBe(true);
  });

  it("does not mark a short fallback transcript as truncated", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Gemini API Error"));

    const { generation } = await generateMoMDetailed(
      "short",
      "2026-08-01",
      "t",
    );
    expect(generation.truncated).toBe(false);
  });

  it("degrades rather than throwing when the provider rejects our credentials", async () => {
    // A missing/invalid key must reach the local fallback in one attempt, not
    // throw out of the service and not burn the retry budget.
    mockGenerateContent.mockRejectedValue(
      Object.assign(new Error("[403 Forbidden] API key not valid"), {
        status: 403,
      }),
    );

    const { generation } = await generateMoMDetailed("t", "2026-08-01", "t");

    expect(generation.degraded).toBe(true);
    expect(generation.errorKind).toBe("auth");
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it("throws only when the fallback also fails", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Gemini API Error"));
    mockLocalSummarizer.mockRejectedValue(new Error("model unavailable"));

    await expect(generateMoMDetailed("t", "2026-08-01", "t")).rejects.toThrow(
      "Both Gemini and Local fallback summarization failed",
    );
  });
});

describe("generateMoMDetailed — prompt budgeting", () => {
  it("chunks a transcript larger than the budget instead of truncating it", async () => {
    process.env.GEMINI_MAX_PROMPT_CHARS = "1000";
    process.env.GEMINI_CHUNK_OVERLAP_CHARS = "0";

    try {
      mockGenerateContent.mockResolvedValue(
        geminiReturns({
          ...fullMoM,
          decisions: ["Ship in September"],
          action_items: [{ task: "Draft the plan" }],
        }),
      );

      const { generation } = await generateMoMDetailed(
        "sentence. ".repeat(400), // ~4000 chars
        "2026-08-01",
        "t",
      );

      expect(generation.chunks).toBeGreaterThan(1);
      expect(mockGenerateContent.mock.calls.length).toBe(generation.chunks);
      expect(generation.degraded).toBe(false);
    } finally {
      delete process.env.GEMINI_MAX_PROMPT_CHARS;
      delete process.env.GEMINI_CHUNK_OVERLAP_CHARS;
    }
  });

  it("merges and de-duplicates chunk results", async () => {
    process.env.GEMINI_MAX_PROMPT_CHARS = "1000";
    process.env.GEMINI_CHUNK_OVERLAP_CHARS = "0";

    try {
      mockGenerateContent
        .mockResolvedValueOnce(
          geminiReturns({
            ...fullMoM,
            summary: "First half.",
            decisions: ["Ship in September"],
            keywords: ["roadmap"],
          }),
        )
        .mockResolvedValue(
          geminiReturns({
            ...fullMoM,
            summary: "Second half.",
            // Restated across the chunk seam — must not appear twice.
            decisions: ["Ship in September", "Hire two engineers"],
            keywords: ["ROADMAP", "hiring"],
          }),
        );

      const { mom } = await generateMoMDetailed(
        "sentence. ".repeat(300),
        "2026-08-01",
        "t",
      );

      expect(mom.decisions).toEqual([
        "Ship in September",
        "Hire two engineers",
      ]);
      // Deduplication is case-insensitive because the model restates things
      // with different capitalisation across the overlap window.
      expect(mom.keywords).toEqual(["roadmap", "hiring"]);
      expect(mom.summary).toContain("First half.");
      expect(mom.summary).toContain("Second half.");
    } finally {
      delete process.env.GEMINI_MAX_PROMPT_CHARS;
      delete process.env.GEMINI_CHUNK_OVERLAP_CHARS;
    }
  });

  it("caps the chunk count and reports the result as degraded", async () => {
    process.env.GEMINI_MAX_PROMPT_CHARS = "500";
    process.env.GEMINI_CHUNK_OVERLAP_CHARS = "0";
    process.env.GEMINI_MAX_CHUNKS = "2";

    try {
      mockGenerateContent.mockResolvedValue(geminiReturns(fullMoM));

      const { generation } = await generateMoMDetailed(
        "sentence. ".repeat(500),
        "2026-08-01",
        "t",
      );

      expect(generation.chunks).toBe(2);
      // Dropping trailing chunks *is* a degradation and must be recorded.
      expect(generation.degraded).toBe(true);
      expect(generation.reason).toBe("chunk_limit_exceeded");
    } finally {
      delete process.env.GEMINI_MAX_PROMPT_CHARS;
      delete process.env.GEMINI_CHUNK_OVERLAP_CHARS;
      delete process.env.GEMINI_MAX_CHUNKS;
    }
  });
});

describe("circuit breaker integration", () => {
  // The shared breaker is configured once at module load, so this exercises the
  // real default threshold (5 consecutive provider failures) rather than trying
  // to override env after the fact.
  const DEFAULT_THRESHOLD = 5;

  it("opens after repeated provider failures and then fails fast", async () => {
    try {
      mockGenerateContent.mockRejectedValue(
        Object.assign(new Error("[503]"), { status: 503 }),
      );

      for (let i = 0; i < DEFAULT_THRESHOLD; i += 1) {
        await generateMoMDetailed(`transcript ${i}`, "2026-08-01", "t");
      }
      expect(getGeminiBreakerState()).toBe("open");

      const callsBefore = mockGenerateContent.mock.calls.length;
      const { generation } = await generateMoMDetailed(
        "one more",
        "2026-08-01",
        "t",
      );

      // The next job must not reach the provider at all — that is the whole
      // point: stop paying timeout × retry to re-confirm a known outage.
      expect(mockGenerateContent.mock.calls.length).toBe(callsBefore);
      expect(generation.errorKind).toBe("circuit_open");
      expect(generation.degraded).toBe(true);
    } finally {
      resetGeminiBreaker();
    }
  });

  it("does not open on errors caused by our own request", async () => {
    try {
      mockGenerateContent.mockRejectedValue(
        Object.assign(new Error("[400 Bad Request]"), { status: 400 }),
      );

      for (let i = 0; i < DEFAULT_THRESHOLD + 2; i += 1) {
        await generateMoMDetailed(`t ${i}`, "2026-08-01", "t");
      }

      // A malformed prompt is not evidence that Gemini is down; opening here
      // would suppress every other caller.
      expect(getGeminiBreakerState()).toBe("closed");
    } finally {
      resetGeminiBreaker();
    }
  });
});

describe("generateMoMWithAI — backwards compatibility", () => {
  it("still returns just the MoM object", async () => {
    mockGenerateContent.mockResolvedValueOnce(geminiReturns(fullMoM));

    const result = await generateMoMWithAI("t", "2026-08-01", "Q3 Planning");
    expect(result).toEqual(fullMoM);
  });
});

describe("generateSessionCardAI", () => {
  it("returns the parsed summary and keywords", async () => {
    mockGenerateContent.mockResolvedValueOnce(
      geminiReturns({ summary: "A talk about X.", keywords: ["x", "y"] }),
    );

    await expect(
      generateSessionCardAI("Event", "Session", "Ada", "Dr", "Bio"),
    ).resolves.toEqual({ summary: "A talk about X.", keywords: ["x", "y"] });
  });

  it("retries a transient failure", async () => {
    mockGenerateContent
      .mockRejectedValueOnce(Object.assign(new Error("[503]"), { status: 503 }))
      .mockResolvedValueOnce(geminiReturns({ summary: "ok", keywords: [] }));

    await expect(
      generateSessionCardAI("Event", "Session"),
    ).resolves.toMatchObject({ summary: "ok" });
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it("throws a typed error instead of a raw SDK error when the provider fails", async () => {
    // This entry point previously had no try/catch at all.
    mockGenerateContent.mockRejectedValue(
      Object.assign(new Error("[401 Unauthorized]"), { status: 401 }),
    );

    await expect(generateSessionCardAI("Event", "Session")).rejects.toThrow(
      /Session card generation failed \(auth\)/,
    );
  });

  it("throws a clear error when the model returns unparseable output", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => "not json at all" },
    });

    await expect(generateSessionCardAI("Event", "Session")).rejects.toThrow(
      "Failed to parse Gemini JSON output",
    );
  });
});

describe("normalizeMoM / buildHumanReadableMoM provenance", () => {
  it("prefers explicitly supplied provenance", () => {
    const generation = { provider: "gemini", degraded: false };
    const result = normalizeMoM({ title: "T" }, "T", "2026-08-01", generation);
    expect(result.generation).toBe(generation);
  });

  it("falls back to provenance embedded in the model output", () => {
    const result = normalizeMoM(
      {
        title: "T",
        generation: { provider: "local-distilbart", degraded: true },
      },
      "T",
      "2026-08-01",
    );
    expect(result.generation.degraded).toBe(true);
  });

  it("defaults to unknown-but-not-degraded for legacy documents", () => {
    // Absence of evidence isn't evidence of degradation — flagging every
    // historical MoM as suspect would make the flag useless.
    const result = normalizeMoM({ title: "T" }, "T", "2026-08-01");
    expect(result.generation).toMatchObject({
      provider: "unknown",
      degraded: false,
    });
  });

  it("adds a visible notice to a degraded document", () => {
    const mom = normalizeMoM(
      {
        title: "T",
        summary: "s",
        agenda: [],
        key_discussions: [],
        decisions: [],
        action_items: [],
        questions_raised: [],
        keywords: [],
        attendees: [],
        generation: { degraded: true, truncated: true },
      },
      "T",
      "2026-08-01",
    );

    const text = buildHumanReadableMoM(mom);
    // Without this, an empty "Decisions" section reads as "no decisions were
    // made" rather than "we never analysed most of the meeting".
    expect(text).toContain("Generation Notice");
    expect(text).toContain("Part of the transcript was not analysed.");
  });

  it("adds no notice to a healthy document", () => {
    const mom = normalizeMoM(
      {
        title: "T",
        summary: "s",
        agenda: [],
        key_discussions: [],
        decisions: [],
        action_items: [],
        questions_raised: [],
        keywords: [],
        attendees: [],
      },
      "T",
      "2026-08-01",
      { provider: "gemini", degraded: false },
    );

    expect(buildHumanReadableMoM(mom)).not.toContain("Generation Notice");
  });
});
