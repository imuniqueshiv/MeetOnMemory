/**
 * Standup report generation (Issue #2426).
 *
 * Pure, IO-free: categorize a set of action items into the classic standup
 * shape — Done (yesterday), In Progress (today), and Blockers — and render it as
 * markdown. Unit-tested; the controller just supplies the items + date window.
 */

const DONE_STATUSES = new Set(["completed", "resolved"]);
const ACTIVE_STATUSES = new Set([
  "open",
  "in-progress",
  "in_progress",
  "pending",
]);
const IGNORED_STATUSES = new Set(["cancelled", "superseded"]);

const slim = (item) => ({
  text: item?.text ?? "",
  owner: item?.owner ?? "Unassigned",
  status: item?.status ?? "open",
  dueDate: item?.dueDate ?? null,
});

/**
 * @param {Array} items
 * @param {{ now?: Date, since?: Date|null }} opts
 * @returns {{ done: any[], inProgress: any[], blockers: any[], counts: object }}
 */
export function categorizeStandup(items, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const since = opts.since instanceof Date ? opts.since : null;
  const list = Array.isArray(items) ? items : [];

  const done = [];
  const inProgress = [];
  const blockers = [];

  for (const item of list) {
    const status = item?.status;
    if (IGNORED_STATUSES.has(status)) continue;

    if (DONE_STATUSES.has(status)) {
      // If a window is given, only count items completed within it (items with
      // no completedAt fall through and are included).
      const completedAt = item?.completedAt ? new Date(item.completedAt) : null;
      if (!since || !completedAt || completedAt >= since) done.push(slim(item));
      continue;
    }

    const due = item?.dueDate ? new Date(item.dueDate) : null;
    const overdue =
      status === "overdue" ||
      (due && !Number.isNaN(due.getTime()) && due < now);
    if (overdue) {
      blockers.push(slim(item));
    } else if (ACTIVE_STATUSES.has(status)) {
      inProgress.push(slim(item));
    }
  }

  return {
    done,
    inProgress,
    blockers,
    counts: {
      done: done.length,
      inProgress: inProgress.length,
      blockers: blockers.length,
    },
  };
}

const bullets = (items) =>
  items.length ? items.map((i) => `- ${i.text}`).join("\n") : "- _None_";

/** Render a categorized standup as a Yesterday / Today / Blockers markdown block. */
export function renderStandupMarkdown(standup) {
  const s = standup || { done: [], inProgress: [], blockers: [] };
  return [
    "**Yesterday**",
    bullets(s.done || []),
    "",
    "**Today**",
    bullets(s.inProgress || []),
    "",
    "**Blockers**",
    bullets(s.blockers || []),
  ].join("\n");
}
