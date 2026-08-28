/**
 * Search explainability helpers for issue #2173.
 *
 * Converts an authorized meeting record plus retrieval signals into a
 * privacy-conscious evidence payload for the search result explanation panel.
 *
 * Important: this module never decides authorization. Callers must first query
 * only meetings the current user is allowed to access.
 */

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "with",
  "why",
]);

const MAX_SNIPPET_LENGTH = 260;
const MAX_EVIDENCE_ITEMS = 8;
const MAX_LIST_ITEMS = 8;

const cleanText = (value) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const normalize = (value) =>
  cleanText(value)
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

const queryTokens = (query) =>
  [
    ...new Set(
      normalize(query)
        .split(/[^a-z0-9]+/i)
        .filter((token) => token.length >= 2 && !STOP_WORDS.has(token)),
    ),
  ].slice(0, 12);

function includesToken(text, token) {
  return normalize(text).includes(normalize(token));
}

function firstMatchingToken(text, tokens) {
  return tokens.find((token) => includesToken(text, token)) || null;
}

function makeSnippet(text, token, maxLength = MAX_SNIPPET_LENGTH) {
  const cleaned = cleanText(text);
  if (!cleaned || !token) return null;

  const lower = cleaned.toLocaleLowerCase();
  const needle = token.toLocaleLowerCase();
  const index = lower.indexOf(needle);
  if (index < 0) return null;

  const context = Math.max(70, Math.floor((maxLength - needle.length) / 2));
  let start = Math.max(0, index - context);
  let end = Math.min(cleaned.length, index + needle.length + context);

  if (start > 0) start = cleaned.indexOf(" ", start) + 1 || start;
  if (end < cleaned.length) {
    const boundary = cleaned.lastIndexOf(" ", end);
    if (boundary > start) end = boundary;
  }

  const prefix = start > 0 ? "…" : "";
  const suffix = end < cleaned.length ? "…" : "";

  return {
    text: `${prefix}${cleaned.slice(start, end)}${suffix}`,
    match: token,
    startOffset: start,
    endOffset: end,
  };
}

function normalizeStructuredList(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return cleanText(item);
      if (!item || typeof item !== "object") return "";
      return cleanText(
        item.text ||
          item.title ||
          item.decision ||
          item.description ||
          item.name ||
          item.topic ||
          "",
      );
    })
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);
}

/**
 * Build explainability evidence from an already-authorized meeting.
 */
export function buildSearchExplainability({
  query,
  meeting,
  similarityScore = 0,
  vectorRank = null,
  meetingId = null,
}) {
  const tokens = queryTokens(query);
  const evidence = [];
  const exactMatches = [];
  const metadataMatches = [];
  const transcriptSnippets = [];

  const addExactMatch = (field, label, value) => {
    const text = cleanText(value);
    const token = firstMatchingToken(text, tokens);
    if (!token) return;

    exactMatches.push({ field, label, match: token });
    evidence.push({
      kind: "exact",
      field,
      label,
      match: token,
    });
  };

  addExactMatch("title", "Meeting title", meeting?.title);
  addExactMatch("description", "Meeting description", meeting?.description);
  addExactMatch("summary", "Meeting summary", meeting?.summary);
  addExactMatch("meetingType", "Meeting type", meeting?.meetingType);

  const tags = Array.isArray(meeting?.tags) ? meeting.tags.filter(Boolean) : [];
  const tagMatches = tags.filter((tag) => firstMatchingToken(tag, tokens));
  if (tagMatches.length) {
    metadataMatches.push({
      field: "tags",
      label: "Matching tags",
      values: tagMatches.slice(0, MAX_LIST_ITEMS),
    });
    evidence.push({
      kind: "metadata",
      field: "tags",
      label: "Matching tags",
      values: tagMatches.slice(0, MAX_LIST_ITEMS),
    });
  }

  const participants = Array.isArray(meeting?.participants)
    ? meeting.participants
    : [];
  const participantMatches = participants
    .map((participant) => cleanText(participant?.name))
    .filter((name) => firstMatchingToken(name, tokens));

  if (participantMatches.length) {
    metadataMatches.push({
      field: "participants",
      label: "Matching participants",
      values: participantMatches.slice(0, MAX_LIST_ITEMS),
    });
    evidence.push({
      kind: "metadata",
      field: "participants",
      label: "Matching participants",
      values: participantMatches.slice(0, MAX_LIST_ITEMS),
    });
  }

  const structured = meeting?.structuredMoM;
  const topics = normalizeStructuredList(
    structured?.topics || structured?.keyTopics || structured?.agenda,
  );
  const decisions = normalizeStructuredList(
    structured?.decisions || structured?.keyDecisions,
  );
  const actionItems = normalizeStructuredList(
    structured?.action_items || structured?.actionItems,
  );

  const matchingTopics = topics.filter((item) =>
    firstMatchingToken(item, tokens),
  );
  const matchingDecisions = decisions.filter((item) =>
    firstMatchingToken(item, tokens),
  );
  const matchingActionItems = actionItems.filter((item) =>
    firstMatchingToken(item, tokens),
  );

  if (matchingTopics.length) {
    metadataMatches.push({
      field: "topics",
      label: "Matching topics",
      values: matchingTopics.slice(0, MAX_LIST_ITEMS),
    });
    evidence.push({
      kind: "metadata",
      field: "topics",
      label: "Matching topics",
      values: matchingTopics.slice(0, MAX_LIST_ITEMS),
    });
  }

  if (matchingDecisions.length) {
    metadataMatches.push({
      field: "decisions",
      label: "Matching decisions",
      values: matchingDecisions.slice(0, MAX_LIST_ITEMS),
    });
    evidence.push({
      kind: "metadata",
      field: "decisions",
      label: "Matching decisions",
      values: matchingDecisions.slice(0, MAX_LIST_ITEMS),
    });
  }

  if (matchingActionItems.length) {
    metadataMatches.push({
      field: "actionItems",
      label: "Matching action items",
      values: matchingActionItems.slice(0, MAX_LIST_ITEMS),
    });
    evidence.push({
      kind: "metadata",
      field: "actionItems",
      label: "Matching action items",
      values: matchingActionItems.slice(0, MAX_LIST_ITEMS),
    });
  }

  // Never expose plaintext transcript evidence from encrypted meetings.
  const transcript =
    meeting?.isTranscriptEncrypted || meeting?.encryptedTranscript
      ? ""
      : cleanText(meeting?.transcript);

  if (transcript) {
    for (const token of tokens) {
      const snippet = makeSnippet(transcript, token);
      if (snippet) {
        transcriptSnippets.push(snippet);
        evidence.push({
          kind: "transcript",
          field: "transcript",
          label: "Transcript passage",
          ...snippet,
        });
        break;
      }
    }
  }

  const modes = [];
  if (
    exactMatches.length ||
    metadataMatches.length ||
    transcriptSnippets.length
  ) {
    modes.push("exact");
  }
  if (Number(similarityScore) > 0) modes.push("semantic");

  const uniqueModes = [...new Set(modes)];
  const resultId = meetingId || meeting?._id?.toString?.() || null;
  const evidenceUrl = resultId
    ? `/meeting/${encodeURIComponent(resultId)}?search=${encodeURIComponent(query)}`
    : null;

  return {
    query,
    matchModes: uniqueModes,
    exactMatches: exactMatches.slice(0, MAX_EVIDENCE_ITEMS),
    metadataMatches: metadataMatches.slice(0, MAX_EVIDENCE_ITEMS),
    transcriptSnippets: transcriptSnippets.slice(0, 3),
    evidence: evidence.slice(0, MAX_EVIDENCE_ITEMS),
    evidenceUrl,
    semantic: {
      score: Number(Number(similarityScore || 0).toFixed(3)),
      matched: Number(similarityScore || 0) > 0,
      vectorRank,
    },
    privacy: {
      transcriptIncluded: transcript.length > 0,
      encryptedTranscriptExcluded: Boolean(
        meeting?.isTranscriptEncrypted || meeting?.encryptedTranscript,
      ),
    },
  };
}

export default buildSearchExplainability;
