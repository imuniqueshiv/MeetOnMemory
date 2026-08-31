/**
 * Meeting notes export (Issue #2543).
 *
 * Pure, IO-free: render a meeting's summary and action items as a clean
 * Markdown document that users can download and share with stakeholders who
 * lack platform access. Unit-tested; the controller just supplies the meeting
 * document and its action items.
 */

const DONE_STATUSES = new Set(["completed", "resolved"]);

const isBlank = (value) =>
  value === null || value === undefined || String(value).trim() === "";

// Format a date as YYYY-MM-DD, tolerating Date objects, ISO strings, or null.
const formatDate = (value) => {
  if (isBlank(value)) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const renderActionItem = (item) => {
  const text = isBlank(item?.text) ? "(untitled)" : String(item.text).trim();
  const checkbox = DONE_STATUSES.has(item?.status) ? "[x]" : "[ ]";

  const meta = [];
  if (!isBlank(item?.owner)) meta.push(String(item.owner).trim());
  if (!isBlank(item?.status)) meta.push(String(item.status).trim());
  const due = formatDate(item?.dueDate);
  if (due) meta.push(`due ${due}`);

  const suffix = meta.length > 0 ? ` — ${meta.join(", ")}` : "";
  return `- ${checkbox} ${text}${suffix}`;
};

/**
 * Render a meeting and its action items as a Markdown document.
 *
 * @param {{ title?: string, date?: Date|string, summary?: string, transcript?: string }} meeting
 * @param {Array} actionItems
 * @param {{ includeTranscript?: boolean }} opts
 * @returns {string} Markdown text
 */
export function renderMeetingNotesMarkdown(
  meeting,
  actionItems = [],
  opts = {},
) {
  const safeMeeting = meeting ?? {};
  const items = Array.isArray(actionItems) ? actionItems : [];
  const lines = [];

  const title = isBlank(safeMeeting.title)
    ? "Untitled Meeting"
    : String(safeMeeting.title).trim();
  lines.push(`# ${title}`);

  const date = formatDate(safeMeeting.date);
  if (date) {
    lines.push("", `_${date}_`);
  }

  lines.push("", "## Summary", "");
  lines.push(
    isBlank(safeMeeting.summary)
      ? "_No summary available._"
      : String(safeMeeting.summary).trim(),
  );

  lines.push("", "## Action Items", "");
  if (items.length === 0) {
    lines.push("_No action items._");
  } else {
    for (const item of items) lines.push(renderActionItem(item));
  }

  if (opts.includeTranscript && !isBlank(safeMeeting.transcript)) {
    lines.push("", "## Transcript", "", String(safeMeeting.transcript).trim());
  }

  return lines.join("\n") + "\n";
}
