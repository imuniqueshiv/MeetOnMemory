import axios from "axios"; // eslint-disable-line no-unused-vars
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  AI_ERROR_KIND,
  callWithResilience,
  createCircuitBreaker,
} from "../utils/aiResilience.js";
import { recordAiUsageSafe } from "./aiUsageMetricsService.js";

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
  try {
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

    const usage = result?.response?.usageMetadata || {};
    recordAiUsageSafe({
      kind: "gemini",
      promptTokens: usage.promptTokenCount,
      completionTokens: usage.candidatesTokenCount,
      totalTokens: usage.totalTokenCount,
    });

    return result.response.text();
  } catch (err) {
    recordAiUsageSafe({ kind: "gemini", error: true });
    throw err;
  }
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

const chunkTextByBudget = (text, { maxChars, overlapChars }) => {
  if (!text) return [];
  const chunks = [];
  let startIndex = 0;
  while (startIndex < text.length) {
    let endIndex = startIndex + maxChars;
    if (endIndex < text.length) {
      const nextNewline = text.indexOf("\n", endIndex);
      if (nextNewline !== -1 && nextNewline - endIndex < 500) {
        endIndex = nextNewline;
      }
    }
    chunks.push(text.slice(startIndex, endIndex));
    startIndex = endIndex - overlapChars;
    if (startIndex < 0) startIndex = 0;
    if (endIndex >= text.length) break;
  }
  return chunks;
};

const buildMoMPrompt = (
  transcriptSegment,
  date,
  title,
  context = {},
  customInstructions = null,
) => {
  const { part, totalParts } = context;
  const chunkNotice =
    part && totalParts > 1
      ? `\n⚠️ This is part ${part} of ${totalParts} of a longer transcript. Extract only what is present in THIS part; do not invent content from the missing parts, and do not summarise the meeting as a whole.\n`
      : "";
  const customInstructionsNotice = customInstructions
    ? `\n⚠️ CUSTOM INSTRUCTIONS: ${customInstructions}\n`
    : "";

  return `
You are an advanced AI meeting assistant responsible for preparing *formal, well-structured Minutes of Meeting (MoM)*
from the transcript provided below.
The MoM should be factual, concise, and formatted for professional use in organizations, universities, or institutions.
Avoid repetition, filler words, and unnecessary phrases. Capture key insights, outcomes, and responsibilities accurately.
${chunkNotice}
${customInstructionsNotice}
🎯 Your goal is to return a clean JSON object with the following fields:
{
  "title": "A clear, professional meeting title (e.g., 'AI Integration Strategy Discussion')",
  "date": "YYYY-MM-DD",
  "summary": "A 2-3 paragraph professional executive summary",
  "agenda": ["Topic 1", "Topic 2"],
  "key_discussions": ["Discussion point 1", "Discussion point 2"],
  "decisions": ["Decision 1", "Decision 2"],
  "action_items": [
    {
      "task": "Specific action to be taken",
      "owner": "Person responsible",
      "due_date": "YYYY-MM-DD or 'TBD'"
    }
  ],
  "attendees": ["Person 1", "Person 2"],
  "questions_raised": ["Question 1", "Question 2"],
  "keywords": ["Keyword1", "Keyword2"],
  "notes": "Any other notable information not covered above"
}

Transcript:
${transcriptSegment}
`;
};

const mergeMoMParts = (parts) => {
  const merged = { ...parts[0] };
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.summary) merged.summary += "\n\n" + part.summary;
    if (part.agenda)
      merged.agenda = [...new Set([...merged.agenda, ...part.agenda])];
    if (part.key_discussions)
      merged.key_discussions = [
        ...merged.key_discussions,
        ...part.key_discussions,
      ];
    if (part.decisions)
      merged.decisions = [...merged.decisions, ...part.decisions];
    if (part.action_items)
      merged.action_items = [...merged.action_items, ...part.action_items];
    if (part.attendees)
      merged.attendees = [...new Set([...merged.attendees, ...part.attendees])];
    if (part.questions_raised)
      merged.questions_raised = [
        ...merged.questions_raised,
        ...part.questions_raised,
      ];
    if (part.keywords)
      merged.keywords = [...new Set([...merged.keywords, ...part.keywords])];
    if (part.notes) merged.notes += "\n\n" + part.notes;
  }
  return merged;
};

const runLocalFallback = async (textToSummarize, date, title, degradation) => {
  return {
    title: title || "Local Summary",
    date,
    summary: textToSummarize.substring(0, 1024),
    generation: { provider: "local", degraded: true, ...degradation },
  };
};

export const generateMoMDetailed = async (
  textToSummarize,
  date,
  title,
  customInstructions = null,
) => {
  const source = String(textToSummarize ?? "");
  const startedAt = Date.now();

  let degradation = { reason: "unknown", errorKind: null };

  try {
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

    const parts = [];
    for (let index = 0; index < usedChunks.length; index += 1) {
      const prompt = buildMoMPrompt(
        usedChunks[index],
        date,
        title,
        { part: index + 1, totalParts: usedChunks.length },
        customInstructions,
      );

      const outputText = await generateText(
        prompt,
        `Gemini MoM part ${index + 1}/${usedChunks.length}`,
      );

      const parsed = parseJsonOutput(outputText);
      parts.push(parsed ?? { rawText: outputText });
    }

    const structured =
      usedChunks.length === 1 ? parts[0] : mergeMoMParts(parts);

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
  }

  try {
    const mom = await runLocalFallback(source, date, title, degradation);
    return {
      mom,
      generation: { ...mom.generation, durationMs: Date.now() - startedAt },
    };
  } catch (_hfErr) {
    throw new Error("Both Gemini and Local fallback summarization failed");
  }
};

export const generateMoMWithAI = async (
  textToSummarize,
  date,
  title,
  customInstructions = null,
) => {
  const { mom } = await generateMoMDetailed(
    textToSummarize,
    date,
    title,
    customInstructions,
  );
  return mom;
};

export const generateDelegationContextBriefing = async (
  meetingTitle,
  delegatorName,
  delegateeName,
  openActionItems,
  recentMeetingNotes,
) => {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Delegation context briefing is unavailable: GEMINI_API_KEY is not configured.",
    );
  }

  const prompt = `
You are an AI assistant helping to prepare a delegation context briefing.
${delegatorName} is delegating their attendance to ${delegateeName} for the upcoming meeting: "${meetingTitle}".

Here are the unresolved action items currently assigned to ${delegatorName} that may be relevant:
${JSON.stringify(openActionItems, null, 2)}

Here are some notes and context from recent related meetings:
${JSON.stringify(recentMeetingNotes, null, 2)}

Based on this information, generate a professional context briefing for ${delegateeName}. The briefing should summarize what ${delegatorName}'s responsibilities were, what is currently outstanding, and what ${delegateeName} needs to focus on or follow up on during the meeting.

Return ONLY a valid JSON object matching this structure (no markdown formatting, no commentary):
{
  "briefing": "A comprehensive 2-3 paragraph context briefing."
}
`;

  let outputText;
  try {
    outputText = await generateText(prompt, "Gemini delegation briefing");
  } catch (err) {
    console.error("❌ Delegation briefing generation failed:", err.message);
    throw new Error(
      `Delegation briefing generation failed (${err.kind ?? AI_ERROR_KIND.UNKNOWN}): ${err.message}`,
    );
  }

  const parsed = parseJsonOutput(outputText);
  if (!parsed || !parsed.briefing) {
    throw new Error(
      "Failed to parse Gemini JSON output for delegation briefing",
    );
  }

  return parsed.briefing;
};

export const generateDelegationPostMeetingReport = async (
  meetingTitle,
  delegatorName,
  delegateeName,
  meetingSummary,
  actionItems,
  decisions,
) => {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Delegation post-meeting report is unavailable: GEMINI_API_KEY is not configured.",
    );
  }

  const prompt = `
You are an AI assistant helping to prepare a post-meeting report for a delegator.
${delegatorName} delegated their attendance to ${delegateeName} for the meeting: "${meetingTitle}".

Here is the general summary of the meeting:
${JSON.stringify(meetingSummary, null, 2)}

Here are the decisions made during the meeting:
${JSON.stringify(decisions, null, 2)}

Here are the action items resulting from the meeting:
${JSON.stringify(actionItems, null, 2)}

Based on this, generate a concise, professional post-meeting report specifically tailored for ${delegatorName}. It should highlight what they missed, any decisions that affect them, and any new action items assigned to them or their delegatee on their behalf.

Return ONLY a valid JSON object matching this structure (no markdown formatting, no commentary):
{
  "report": "A comprehensive 2-3 paragraph post-meeting report."
}
`;

  let outputText;
  try {
    outputText = await generateText(prompt, "Gemini delegation report");
  } catch (err) {
    console.error("❌ Delegation report generation failed:", err.message);
    throw new Error(
      `Delegation report generation failed (${err.kind ?? AI_ERROR_KIND.UNKNOWN}): ${err.message}`,
    );
  }

  const parsed = parseJsonOutput(outputText);
  if (!parsed || !parsed.report) {
    throw new Error("Failed to parse Gemini JSON output for delegation report");
  }

  return parsed.report;
};

export const generateHighlightReelAI = async (
  meetingTitle,
  transcript,
  keyMoments,
  sentimentTimeline,
) => {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Highlight Reel generation is unavailable: GEMINI_API_KEY is not configured.",
    );
  }

  const prompt = `
You are an AI meeting assistant. Create a structured highlight reel for the meeting: "${meetingTitle}".

Here is the meeting transcript (in segments):
${JSON.stringify(transcript, null, 2)}

Here are the user-identified key moments:
${JSON.stringify(keyMoments, null, 2)}

Here is the sentiment timeline:
${JSON.stringify(sentimentTimeline, null, 2)}

Your task is to identify the most critical 3-8 highlights from the meeting (e.g., breakthroughs, key decisions, action items, important debates).
For each highlight, include:
- type: "decision", "action_item", "insight", "breakthrough", "debate", or "other"
- timestamp: The start time in seconds (match with transcript/key moment data)
- speaker: The person speaking
- excerpt: An exact quote or highly accurate paraphrase from the transcript
- sentiment: "positive", "neutral", or "negative"
- importance: An integer from 1-10
- aiRationale: A brief explanation (1-2 sentences) of why this moment was selected as a highlight.

Also, provide an overall "narrative" (2-3 paragraphs) summarizing the arc of the meeting.

Return ONLY a valid JSON object matching this structure (no markdown formatting, no commentary):
{
  "narrative": "Overall narrative...",
  "highlights": [
    {
      "type": "decision",
      "timestamp": 120,
      "speaker": "Alice",
      "excerpt": "We are going with the new design.",
      "sentiment": "positive",
      "importance": 9,
      "aiRationale": "This was the final decision made on the primary agenda topic."
    }
  ]
}
`;

  let outputText;
  try {
    // Generate text using the shared resilient method
    outputText = await generateText(prompt, "Gemini highlight reel");
  } catch (err) {
    console.error("❌ Highlight reel generation failed:", err.message);
    throw new Error(
      `Highlight reel generation failed (${err.kind ?? AI_ERROR_KIND.UNKNOWN}): ${err.message}`,
    );
  }

  const parsed = parseJsonOutput(outputText);
  if (!parsed || !parsed.narrative || !Array.isArray(parsed.highlights)) {
    throw new Error("Failed to parse Gemini JSON output for highlight reel");
  }

  return parsed;
};

export const generateSeriesRetrospectiveSummary = async (
  seriesTitle,
  metricsData,
) => {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Series Retrospective generation is unavailable: GEMINI_API_KEY is not configured.",
    );
  }

  const prompt = `
You are an AI meeting assistant. Your task is to generate a narrative retrospective summary for a meeting series.
Series Title: "${seriesTitle}"

Here is the aggregated metrics data for the series:
${JSON.stringify(metricsData, null, 2)}

Based on this data, provide a professional, 3-4 paragraph narrative summarizing the evolution of this meeting series.
Focus on:
1. Are topics recurring too often without resolution?
2. Are action items being completed consistently, or are there chronic carryovers?
3. How is the attendance trend?
4. How is the overall sentiment evolving?
5. Are decisions actually being followed through?

Return ONLY a valid JSON object matching this structure (no markdown formatting, no commentary):
{
  "summary": "The narrative summary..."
}
`;

  let outputText;
  try {
    outputText = await generateText(prompt, "Gemini series retrospective");
  } catch (err) {
    console.error("❌ Series retrospective generation failed:", err.message);
    throw new Error(
      `Series retrospective generation failed (${err.kind ?? AI_ERROR_KIND.UNKNOWN}): ${err.message}`,
    );
  }

  const parsed = parseJsonOutput(outputText);
  if (!parsed || !parsed.summary) {
    throw new Error(
      "Failed to parse Gemini JSON output for series retrospective",
    );
  }

  return parsed.summary;
};

export const generateStandupReportAI = async (
  userName,
  timeframe,
  meetingsContext,
  completedItemsContext,
  upcomingItemsContext,
  blockersContext,
  decisionsContext,
) => {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Standup report generation is unavailable: GEMINI_API_KEY is not configured.",
    );
  }

  const prompt = `
You are an AI assistant tasked with writing a concise, professional standup report for a team member named ${userName}.
The timeframe for this report is: ${timeframe}.

Here is the data context for ${userName}:

Attended Meetings:
${meetingsContext}

Decisions Participated In:
${decisionsContext}

Completed Action Items:
${completedItemsContext}

Upcoming Action Items:
${upcomingItemsContext}

Overdue/Blocked Action Items:
${blockersContext}

Write a standup-style report (written in the first person, as if ${userName} is speaking) covering:
1. What I did (accomplishments, completed items, meetings attended)
2. What I will do (upcoming tasks, ongoing focus)
3. Blockers (anything overdue or explicitly marked blocked)

Keep it concise, actionable, and suitable for a team update. Do not invent information; only use what is provided. If a section is empty, summarize appropriately without making things up.

Return ONLY a valid JSON object matching this structure (no markdown formatting, no commentary):
{
  "summary": "A 2-3 paragraph standup report"
}
`;

  let outputText;
  try {
    outputText = await generateText(prompt, "Gemini standup report");
  } catch (err) {
    console.error("❌ Standup report generation failed:", err.message);
    throw new Error(
      `Standup report generation failed (${err.kind ?? AI_ERROR_KIND.UNKNOWN}): ${err.message}`,
    );
  }

  const parsed = parseJsonOutput(outputText);
  if (!parsed || !parsed.summary) {
    throw new Error("Failed to parse Gemini JSON output for standup report");
  }

  return parsed.summary;
};

export const generateAbsenteeCatchUpAI = async (
  meetingTitle,
  absenteeName,
  meetingSummary,
  actionItems,
  decisions,
  mentions,
) => {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Absentee catch-up generation is unavailable: GEMINI_API_KEY is not configured.",
    );
  }

  const prompt = `
You are an AI assistant helping to prepare a personalized meeting catch-up digest for an absent participant.
The participant's name is ${absenteeName}, and they missed the meeting: "${meetingTitle}".

Here is the general summary of the meeting:
${JSON.stringify(meetingSummary, null, 2)}

Here are the decisions made during the meeting:
${JSON.stringify(decisions, null, 2)}

Here are the action items resulting from the meeting:
${JSON.stringify(actionItems, null, 2)}

Here are specific moments they were mentioned:
${JSON.stringify(mentions, null, 2)}

Based on this information, generate a concise, professional personalized catch-up report tailored specifically for ${absenteeName}. 
The report should summarize what they missed, clearly state any decisions that affect them, highlight any action items assigned to them, and explain context around when they were mentioned.

Return ONLY a valid JSON object matching this structure (no markdown formatting, no commentary):
{
  "catchUpReport": "A comprehensive 2-3 paragraph personalized catch-up report.",
  "actionItemsAssigned": ["...", "..."],
  "keyTakeaways": ["...", "..."]
}
`;

  let outputText;
  try {
    outputText = await generateText(prompt, "Gemini absentee catch-up");
  } catch (err) {
    console.error("❌ Absentee catch-up generation failed:", err.message);
    throw new Error(
      `Absentee catch-up generation failed (${err.kind ?? AI_ERROR_KIND.UNKNOWN}): ${err.message}`,
    );
  }

  const parsed = parseJsonOutput(outputText);
  if (!parsed || !parsed.catchUpReport) {
    throw new Error("Failed to parse Gemini JSON output for absentee catch-up");
  }

  return parsed;
};
