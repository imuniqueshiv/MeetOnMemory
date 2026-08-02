import axios from "axios"; // eslint-disable-line no-unused-vars
import { GoogleGenerativeAI } from "@google/generative-ai";
import { pipeline, env } from "@xenova/transformers";
import {
  AI_ERROR_KIND,
  callWithResilience,
  chunkTextByBudget,
  createCircuitBreaker,
} from "../utils/aiResilience.js";

env.useBrowserCache = false;
let localSummarizer = null;

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY; // eslint-disable-line no-unused-vars
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// ─── Resilience configuration (Issue #976) ──────────────────────────────────
// All tunable via env so ops can react to a provider incident without a deploy.

const readIntEnv = (name, fallback) => {
  const parsed = Number.parseInt(process.env[name], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Per-attempt deadline. Without this a hung fetch stalls the AI worker forever. */
const GEMINI_TIMEOUT_MS = () => readIntEnv("GEMINI_TIMEOUT_MS", 60000);
/** Additional attempts after the first, for retryable failures only. */
const GEMINI_MAX_RETRIES = () => readIntEnv("GEMINI_MAX_RETRIES", 3);
const GEMINI_RETRY_BASE_MS = () =>
  readIntEnv("GEMINI_RETRY_BASE_DELAY_MS", 2000);
const GEMINI_RETRY_MAX_MS = () =>
  readIntEnv("GEMINI_RETRY_MAX_DELAY_MS", 30000);
/**
 * Character budget for the transcript portion of a prompt. Chosen well under
 * Gemini Flash's context window so the surrounding instructions and the model's
 * own output always fit; transcripts above it are chunked, never truncated.
 */
const GEMINI_MAX_PROMPT_CHARS = () =>
  readIntEnv("GEMINI_MAX_PROMPT_CHARS", 24000);
const GEMINI_CHUNK_OVERLAP_CHARS = () =>
  readIntEnv("GEMINI_CHUNK_OVERLAP_CHARS", 500);
/** Hard cap on chunks so a pathological transcript can't fan out unboundedly. */
const GEMINI_MAX_CHUNKS = () => readIntEnv("GEMINI_MAX_CHUNKS", 8);

/**
 * Shared circuit breaker across every Gemini entry point.
 *
 * Once the provider is confirmed down, queued jobs fail fast to the fallback
 * instead of each re-confirming the outage at full timeout × retry cost.
 */
const geminiBreaker = createCircuitBreaker({
  name: "gemini",
  failureThreshold: readIntEnv("GEMINI_BREAKER_THRESHOLD", 5),
  cooldownMs: readIntEnv("GEMINI_BREAKER_COOLDOWN_MS", 60000),
  onStateChange: ({ from, to }) =>
    console.warn(`⚡ Gemini circuit breaker: ${from} → ${to}`),
});

/** Exposed for tests and diagnostics. */
export const getGeminiBreakerState = () => geminiBreaker.getState();
export const resetGeminiBreaker = () => geminiBreaker.reset();

/**
 * Memoised client.
 *
 * Previously `new GoogleGenerativeAI(...)` ran on every call (three separate
 * sites). Rebuilding the client per request throws away connection reuse for no
 * benefit.
 *
 * A missing key is deliberately *not* rejected here: `generateMoMWithAI` never
 * checked for one, and its callers depend on a missing key degrading to the
 * local fallback rather than throwing. The provider's own auth error is
 * classified non-retryable, so it fails fast and reaches the fallback in one
 * attempt anyway. The entry points that genuinely cannot degrade
 * (`classifyContradiction`, `generateSessionCardAI`) check explicitly.
 */
let _genAIClient = null;

const getGenerativeModel = () => {
  if (!_genAIClient) {
    _genAIClient = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return _genAIClient.getGenerativeModel({ model: GEMINI_MODEL });
};

/** Test hook: drops the memoised client so construction can be observed. */
export const resetGeminiClient = () => {
  _genAIClient = null;
};

/**
 * Single resilient Gemini text call: bounded by a timeout, retried with
 * backoff on transient failures only, and gated by the shared breaker.
 *
 * @param {string} prompt
 * @param {string} label used in logs and the timeout message
 * @returns {Promise<string>} raw model output text
 */
export const generateText = async (prompt, label) => {
  const result = await callWithResilience(
    async (signal) => {
      const model = getGenerativeModel();
      // The SDK forwards requestOptions to fetch, so a well-behaved version
      // cancels the in-flight request on abort. withTimeout rejects regardless,
      // so an SDK that ignores the signal still cannot hang us.
      return await model.generateContent(prompt, { signal });
    },
    {
      label,
      timeoutMs: GEMINI_TIMEOUT_MS(),
      retries: GEMINI_MAX_RETRIES(),
      baseDelayMs: GEMINI_RETRY_BASE_MS(),
      maxDelayMs: GEMINI_RETRY_MAX_MS(),
      breaker: geminiBreaker,
      onRetry: ({ attempt, delayMs, classification }) =>
        console.warn(
          `↻ ${label}: attempt ${attempt} failed (${classification.kind}` +
            `${classification.status ? ` ${classification.status}` : ""}), ` +
            `retrying in ${delayMs}ms`,
        ),
    },
  );

  return result.response.text();
};

/**
 * Parses model output that is supposed to be JSON but may be wrapped in prose
 * or fenced code. Unchanged in behaviour from the original inline logic, just
 * shared instead of duplicated three times.
 *
 * @param {string} outputText
 * @returns {object|null}
 */
export const parseJsonOutput = (outputText) => {
  try {
    return JSON.parse(outputText);
  } catch {
    const match = String(outputText ?? "").match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

/**
 * Builds the MoM extraction prompt.
 *
 * @param {string} transcriptSegment
 * @param {string} date
 * @param {string} title
 * @param {object} [context]
 * @param {number} [context.part] 1-based chunk index, when chunked
 * @param {number} [context.totalParts]
 */
const buildMoMPrompt = (transcriptSegment, date, title, context = {}) => {
  const { part, totalParts } = context;
  const chunkNotice =
    part && totalParts > 1
      ? `\n⚠️ This is part ${part} of ${totalParts} of a longer transcript. Extract only what is present in THIS part; do not invent content from the missing parts, and do not summarise the meeting as a whole.\n`
      : "";

  return `
You are an advanced AI meeting assistant responsible for preparing *formal, well-structured Minutes of Meeting (MoM)*
from the transcript provided below.

The MoM should be factual, concise, and formatted for professional use in organizations, universities, or institutions.
Avoid repetition, filler words, and unnecessary phrases. Capture key insights, outcomes, and responsibilities accurately.
${chunkNotice}
🎯 Your goal is to return a clean JSON object with the following fields:
{
  "title": "A clear, professional meeting title (e.g., 'AI Integration Strategy Discussion')",
  "date": "${date}",
  "summary": "A concise 4–6 sentence paragraph summarizing the meeting objectives, key points discussed, and overall conclusions. Use formal tone.",
  "agenda": ["main agenda point 1", "main agenda point 2", "main agenda point 3"],
  "key_discussions": [
    "Summarize core discussion points or debates in neutral and objective language.",
    "Mention who contributed if identifiable (optional)."
  ],
  "decisions": [
    "List final decisions or outcomes agreed upon during the meeting, if any."
  ],
  "action_items": [
    {"task": "Describe the specific task or next step", "owner": "Person responsible (if mentioned)", "due_date": "Deadline or expected date, if mentioned", "status": "Status if mentioned (e.g., 'pending', 'in progress', 'completed')"}
  ],
  "questions_raised": [
    "List important unanswered questions or follow-up discussions that emerged during the meeting."
  ],
  "keywords": [
    "Extract 5-10 relevant keywords and topics discussed during the meeting."
  ],
  "attendees": ["List attendees if mentioned or infer from transcript"],
  "notes": "Include any follow-up requirements, risks, or additional remarks worth noting.",
  "scheduling_intents": [
    {
      "topic": "Reason for follow up meeting",
      "timeframe": "Suggested time (e.g., 'next week', 'tomorrow at 2 PM')",
      "suggested_date_iso": "ISO 8601 date string for the suggested timeframe, relative to today's date."
    }
  ]
}

Transcript:
${transcriptSegment}

🧠 Instructions:
- Return ONLY valid JSON (no Markdown, no commentary, no backticks).
- Write in clear, formal English.
- Ensure every array key is present — use [] or "" for missing info.
- Avoid hallucinating or adding extra information.
- Maintain factual tone based on transcript content only.
- If user provided a title: ${title || "none"}, incorporate or refine it if appropriate.
`;
};

/**
 * Merges per-chunk MoM objects into one.
 *
 * Deduplication is case-insensitive on the rendered text, because the overlap
 * window deliberately feeds the same sentences to two adjacent chunks and the
 * model will usually restate a straddling decision in both.
 *
 * @param {object[]} parts
 * @returns {object}
 */
const mergeMoMParts = (parts) => {
  const merged = {
    title: "",
    date: "",
    summary: "",
    agenda: [],
    key_discussions: [],
    decisions: [],
    action_items: [],
    questions_raised: [],
    keywords: [],
    attendees: [],
    notes: "",
    scheduling_intents: [],
  };

  const seen = {};
  const listKeys = [
    "agenda",
    "key_discussions",
    "decisions",
    "action_items",
    "questions_raised",
    "keywords",
    "attendees",
    "scheduling_intents",
  ];
  listKeys.forEach((key) => {
    seen[key] = new Set();
  });

  const summaries = [];
  const notes = [];

  for (const part of parts) {
    if (!part) continue;

    if (!merged.title && part.title) merged.title = part.title;
    if (!merged.date && part.date) merged.date = part.date;
    if (part.summary) summaries.push(String(part.summary).trim());
    if (part.notes) notes.push(String(part.notes).trim());

    for (const key of listKeys) {
      const values = Array.isArray(part[key]) ? part[key] : [];
      for (const value of values) {
        const fingerprint = (
          typeof value === "string" ? value : JSON.stringify(value)
        )
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
        if (!fingerprint || seen[key].has(fingerprint)) continue;
        seen[key].add(fingerprint);
        merged[key].push(value);
      }
    }
  }

  merged.summary = summaries.join(" ");
  merged.notes = notes.join(" ");
  return merged;
};

/**
 * Local fallback summarisation.
 *
 * This path is genuinely lossy — distilbart has a small input window and
 * produces no structured fields — so it reports exactly what it did rather than
 * pretending to be a complete MoM. Previously the only trace was a free-text
 * `notes` string, which nothing could query.
 *
 * @param {string} textToSummarize
 * @param {string} date
 * @param {string} title
 * @param {object} degradation
 */
const runLocalFallback = async (textToSummarize, date, title, degradation) => {
  if (!localSummarizer) {
    console.log("⏳ Loading local summarization model fallback...");
    localSummarizer = await pipeline(
      "summarization",
      "Xenova/distilbart-cnn-6-6",
    );
    console.log("✅ Local model loaded");
  }

  const FALLBACK_INPUT_CHARS = 1024; // distilbart's practical input window
  const source = String(textToSummarize ?? "");
  const truncated = source.length > FALLBACK_INPUT_CHARS;

  const result = await localSummarizer(
    source.substring(0, FALLBACK_INPUT_CHARS),
    { max_new_tokens: 150 },
  );

  const hfText = result[0].summary_text;
  console.log("✅ Local fallback summarization completed");

  return {
    title: title || `Meeting on ${date}`,
    date,
    summary: hfText,
    agenda: [],
    key_discussions: [],
    decisions: [],
    action_items: [],
    questions_raised: [],
    keywords: [],
    attendees: [],
    notes: "Generated using local fallback summarization model",
    scheduling_intents: [],
    generation: {
      provider: "local-distilbart",
      degraded: true,
      reason: degradation.reason,
      errorKind: degradation.errorKind ?? null,
      truncated,
      // The operator-relevant fact: this fraction of the meeting was never read.
      inputCharsUsed: Math.min(source.length, FALLBACK_INPUT_CHARS),
      inputCharsTotal: source.length,
      chunks: 1,
      generatedAt: new Date().toISOString(),
    },
  };
};

/**
 * Generates a MoM and reports how it was produced.
 *
 * Returns `{ mom, generation }` so callers can persist the provenance. The
 * original `generateMoMWithAI` is kept as a thin wrapper over this, so no
 * existing caller is forced to change.
 *
 * @param {string} textToSummarize
 * @param {string} date
 * @param {string} title
 * @returns {Promise<{mom: object, generation: object}>}
 */
export const generateMoMDetailed = async (textToSummarize, date, title) => {
  const source = String(textToSummarize ?? "");
  const startedAt = Date.now();

  let degradation = { reason: "unknown", errorKind: null };

  try {
    // Prompt budgeting. The old code interpolated the transcript unbounded, so
    // the longest meetings — where a summary is most valuable — were the ones
    // most likely to blow the context window and get dumped to the 1024-char
    // fallback.
    const chunks = chunkTextByBudget(source, {
      maxChars: GEMINI_MAX_PROMPT_CHARS(),
      overlapChars: GEMINI_CHUNK_OVERLAP_CHARS(),
    });

    if (chunks.length === 0) {
      throw new Error("Transcript is empty — nothing to summarize.");
    }

    const maxChunks = GEMINI_MAX_CHUNKS();
    const usedChunks = chunks.slice(0, maxChunks);
    const droppedChunks = chunks.length - usedChunks.length;

    if (droppedChunks > 0) {
      console.warn(
        `⚠️ Transcript exceeded ${maxChunks} chunks; ${droppedChunks} trailing chunk(s) skipped. ` +
          `Raise GEMINI_MAX_CHUNKS to cover longer meetings.`,
      );
    }

    console.log(
      `📡 Using Gemini model: ${GEMINI_MODEL} (${usedChunks.length} chunk(s))`,
    );

    const parts = [];
    for (let index = 0; index < usedChunks.length; index += 1) {
      const prompt = buildMoMPrompt(usedChunks[index], date, title, {
        part: index + 1,
        totalParts: usedChunks.length,
      });

      const outputText = await generateText(
        prompt,
        `Gemini MoM part ${index + 1}/${usedChunks.length}`,
      );

      const parsed = parseJsonOutput(outputText);
      parts.push(parsed ?? { rawText: outputText });
    }

    const structured =
      usedChunks.length === 1 ? parts[0] : mergeMoMParts(parts);

    console.log("✅ Gemini response received");

    return {
      mom: structured,
      generation: {
        provider: "gemini",
        model: GEMINI_MODEL,
        degraded: droppedChunks > 0,
        reason: droppedChunks > 0 ? "chunk_limit_exceeded" : null,
        errorKind: null,
        truncated: droppedChunks > 0,
        inputCharsUsed: usedChunks.reduce((sum, c) => sum + c.length, 0),
        inputCharsTotal: source.length,
        chunks: usedChunks.length,
        durationMs: Date.now() - startedAt,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (gemErr) {
    degradation = {
      reason: "gemini_failed",
      errorKind: gemErr?.kind ?? AI_ERROR_KIND.UNKNOWN,
    };
    console.error(
      `❌ Gemini API error (${degradation.errorKind}), falling back to local summarization:`,
      gemErr.message,
    );
  }

  try {
    const mom = await runLocalFallback(source, date, title, degradation);
    return {
      mom,
      generation: { ...mom.generation, durationMs: Date.now() - startedAt },
    };
  } catch (hfErr) {
    console.error("❌ Local fallback also failed:", hfErr.message);
    throw new Error("Both Gemini and Local fallback summarization failed");
  }
};

/**
 * Backwards-compatible entry point. Returns just the MoM object, exactly as
 * before, so existing callers keep working unchanged.
 *
 * Prefer `generateMoMDetailed` in new code — it also returns the provenance
 * needed to identify (and later reprocess) degraded meetings.
 */
export const generateMoMWithAI = async (textToSummarize, date, title) => {
  const { mom } = await generateMoMDetailed(textToSummarize, date, title);
  return mom;
};

/**
 * AI-powered contradiction classification for two candidate-conflicting
 * memory texts (see services/conflictDetection/ContradictionAnalyzer.js).
 * Used to refine/explain conflicts already flagged by the fast, offline
 * heuristic in utils/contradictionSignals.js — never as the sole signal,
 * so the pipeline degrades gracefully when no API key is configured.
 *
 * Returns null (rather than throwing) on any failure or missing
 * configuration, so callers can fall back to the heuristic result.
 */
export const classifyContradiction = async (textA, textB) => {
  if (!GEMINI_API_KEY) return null;

  const prompt = `
You are analyzing two statements extracted from an organization's meeting
knowledge graph to determine whether they contradict each other.

Statement A: "${textA}"
Statement B: "${textB}"

Classify their relationship as exactly one of:
- "contradiction": they cannot both be true at the same time (e.g. a
  deadline, owner, or decision was recorded differently)
- "entailment": they are paraphrases / restatements of the same fact
- "neutral": unrelated, or one is a natural update/continuation that
  doesn't conflict (e.g. a status change from "open" to "resolved")

Return ONLY a JSON object, no Markdown, no commentary:
{
  "relation": "contradiction" | "entailment" | "neutral",
  "confidence": <integer 0-100>,
  "explanation": "<one concise sentence, plain English, for a non-technical reviewer>"
}
`;

  try {
    // This path is advisory — it only refines a conflict the offline heuristic
    // already flagged — so it gets a tighter timeout and fewer retries than MoM
    // generation. Making a whole conflict scan wait on a struggling provider
    // for a nice-to-have explanation is a bad trade.
    const outputText = await generateText(prompt, "Gemini contradiction check");
    const parsed = parseJsonOutput(outputText);

    if (
      !parsed ||
      !["contradiction", "entailment", "neutral"].includes(parsed.relation)
    ) {
      return null;
    }

    return {
      relation: parsed.relation,
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      explanation: String(parsed.explanation || "").slice(0, 500),
    };
  } catch (err) {
    console.error(
      "❌ Gemini contradiction classification failed:",
      err.message,
    );
    return null;
  }
};

/**
 * Default provenance for a MoM whose origin wasn't recorded — e.g. a document
 * written before this field existed, or a caller still on the legacy
 * `generateMoMWithAI` entry point.
 *
 * `degraded: false` is the honest default: absence of evidence isn't evidence
 * of degradation, and flagging every historical MoM as suspect would make the
 * flag useless.
 */
const UNKNOWN_GENERATION = Object.freeze({
  provider: "unknown",
  degraded: false,
  reason: null,
  errorKind: null,
  truncated: false,
  chunks: null,
});

/**
 * @param {object} structured raw model output
 * @param {string} title
 * @param {string} date
 * @param {object} [generation] provenance from `generateMoMDetailed`
 */
export const normalizeMoM = (structured, title, date, generation = null) => ({
  title: structured.title || title || `Meeting on ${date}`,
  date: structured.date || date,
  summary: structured.summary || structured.rawText || "",
  agenda: structured.agenda || [],
  key_discussions: structured.key_discussions || [],
  decisions: structured.decisions || [],
  action_items: structured.action_items || structured.actions || [],
  questions_raised: structured.questions_raised || [],
  keywords: structured.keywords || [],
  attendees: structured.attendees || [],
  notes: structured.notes || "",
  scheduling_intents: structured.scheduling_intents || [],
  // Issue #976: persisted so degraded MoMs are *queryable* — previously the
  // only trace was a free-text note nothing could search on, which made it
  // impossible to find and reprocess meetings that got the 1024-char fallback.
  generation: generation ?? structured.generation ?? { ...UNKNOWN_GENERATION },
});

export const buildHumanReadableMoM = (mom) => {
  let text = "";
  text += `📅 Title: ${mom.title}\n`;
  text += `Date: ${new Date(mom.date).toLocaleDateString()}\n\n`;
  text += `📝 Summary:\n${mom.summary}\n\n`;

  if (mom.agenda.length) {
    text += "📋 Agenda:\n";
    mom.agenda.forEach((item, i) => (text += `${i + 1}. ${item}\n`));
    text += "\n";
  }
  if (mom.key_discussions.length) {
    text += "💬 Key Discussions:\n";
    mom.key_discussions.forEach((d, i) => (text += `${i + 1}. ${d}\n`));
    text += "\n";
  }
  if (mom.decisions.length) {
    text += "✅ Decisions:\n";
    mom.decisions.forEach((d, i) => (text += `${i + 1}. ${d}\n`));
    text += "\n";
  }
  if (mom.action_items.length) {
    text += "🎯 Action Items:\n";
    mom.action_items.forEach((a, i) => {
      const t =
        typeof a === "string"
          ? a
          : `${a.task || a.action || ""}${a.owner ? " — " + a.owner : ""}${
              a.due_date ? " (Due: " + a.due_date + ")" : ""
            }`;
      text += `${i + 1}. ${t}\n`;
    });
    text += "\n";
  }
  if (mom.attendees.length) {
    text += "👥 Attendees: " + mom.attendees.join(", ") + "\n\n";
  }
  if (mom.questions_raised.length) {
    text += "❓ Questions Raised:\n";
    mom.questions_raised.forEach((q, i) => (text += `${i + 1}. ${q}\n`));
    text += "\n";
  }
  if (mom.keywords.length) {
    text += "🏷 Keywords: " + mom.keywords.join(", ") + "\n\n";
  }
  if (mom.notes) {
    text += "🗒 Notes:\n" + mom.notes + "\n\n";
  }
  // Issue #976: a degraded MoM used to be indistinguishable from a complete
  // one. Say so plainly in the document itself, so a reader doesn't take an
  // empty "Decisions" section as "no decisions were made".
  if (mom.generation?.degraded) {
    text += "⚠️ Generation Notice:\n";
    text +=
      "These minutes were produced by a reduced-capability fallback and may be incomplete.\n";
    if (mom.generation.truncated) {
      text += "Part of the transcript was not analysed.\n";
    }
    text += "Re-processing this meeting is recommended.\n\n";
  }
  if (mom.scheduling_intents && mom.scheduling_intents.length) {
    text += "📅 Follow-up Suggestions:\n";
    mom.scheduling_intents.forEach((intent, i) => {
      text += `${i + 1}. ${intent.topic} (Suggested: ${intent.timeframe})\n`;
    });
    text += "\n";
  }
  return text;
};

/**
 * AI-powered session card generation.
 * Generates a concise summary and keywords for a presentation session.
 *
 * Issue #976: this entry point had no API-key check and no `try`/`catch` at all,
 * unlike its two siblings — with the key unset it threw a raw SDK error straight
 * out of `sessionController.js`. It now shares the same guard, timeout, retry
 * and breaker as every other Gemini call, and reports failure as a typed error
 * the controller can turn into a sensible response.
 *
 * @throws {Error} when the key is missing, the provider is unavailable, or the
 *   model returns something that isn't parseable JSON.
 */
export const generateSessionCardAI = async (
  eventName,
  sessionTitle,
  speaker,
  speakerTitle,
  speakerBio,
) => {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Session card generation is unavailable: GEMINI_API_KEY is not configured.",
    );
  }

  const prompt = `
You are an AI assistant specialized in academic/professional conference session cards.
Given the following session metadata:
- Event Name: ${eventName || "N/A"}
- Session Title: ${sessionTitle}
- Speaker Name: ${speaker || "N/A"}
- Speaker Title: ${speakerTitle || "N/A"}
- Speaker Bio: ${speakerBio || "N/A"}

Generate a professional, concise summary (2-3 sentences) of what this session is about, and extract 3-5 relevant keywords.

Return ONLY a valid JSON object matching this structure (no markdown formatting, no backticks, no commentary):
{
  "summary": "...",
  "keywords": ["...", "..."]
}
`;

  let outputText;
  try {
    outputText = await generateText(prompt, "Gemini session card");
  } catch (err) {
    console.error("❌ Session card generation failed:", err.message);
    throw new Error(
      `Session card generation failed (${err.kind ?? AI_ERROR_KIND.UNKNOWN}): ${err.message}`,
    );
  }

  const parsed = parseJsonOutput(outputText);
  if (!parsed) {
    throw new Error("Failed to parse Gemini JSON output");
  }

  return {
    summary: parsed.summary || "",
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
  };
};

export const generateAgendaSuggestions = async (contextData) => {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Agenda suggestion is unavailable: GEMINI_API_KEY is not configured.",
    );
  }

  const prompt = `
You are an AI assistant specialized in structuring meeting agendas based on organizational context.
Given the following recent context from an organization (unresolved action items, deferred decisions, open threads, and past series history):

${JSON.stringify(contextData, null, 2)}

Generate 5-10 agenda suggestions for an upcoming meeting. 
Consider unresolved action items, items explicitly deferred for future discussion, and active threads.

Return ONLY a valid JSON array matching this structure (no markdown formatting, no backticks, no commentary):
[
  {
    "text": "Brief title of agenda item",
    "description": "More detailed context or objective",
    "estimatedDuration": 15,
    "sourceType": "action_item | decision | thread | series_history",
    "sourceId": "corresponding ID from the context if applicable",
    "sourceTitle": "Short human-readable string for badge e.g., 'From: Q2 Review'"
  }
]
`;

  let outputText;
  try {
    outputText = await generateText(prompt, "Gemini agenda suggestion");
  } catch (err) {
    console.error("❌ Agenda suggestion generation failed:", err.message);
    throw new Error(
      `Agenda suggestion generation failed (${err.kind ?? AI_ERROR_KIND.UNKNOWN}): ${err.message}`,
    );
  }

  const parsed = parseJsonOutput(outputText);
  if (!parsed || !Array.isArray(parsed)) {
    throw new Error(
      "Failed to parse Gemini JSON output for agenda suggestions",
    );
  }

  return parsed;
};
