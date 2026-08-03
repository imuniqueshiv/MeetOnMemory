/**
 * Helpers for creating a follow-up meeting draft from Tasks / action items (#721).
 */

export const FOLLOW_UP_ELIGIBLE_STATUSES = ["open", "in-progress"];

export const isFollowUpEligible = (task) =>
  Boolean(task) && FOLLOW_UP_ELIGIBLE_STATUSES.includes(task.status);

/**
 * Build a schedule-meeting draft from selected action items.
 * Reuses the existing CreateMeeting form fields (title, description, agendaItems).
 *
 * @param {Array<{ id: string, title: string, owner?: string, dueDate?: string|Date, meetingTitle?: string, status: string }>} tasks
 * @returns {{ title: string, description: string, agendaItems: Array, sourceActionItemIds: string[] }}
 */
export const buildFollowUpMeetingDraft = (tasks = []) => {
  const eligible = tasks.filter(isFollowUpEligible);

  const meetingTitles = [
    ...new Set(eligible.map((t) => t.meetingTitle).filter(Boolean)),
  ];

  let title;
  if (meetingTitles.length === 1) {
    title = `Follow-up: ${meetingTitles[0]}`;
  } else if (meetingTitles.length > 1) {
    title = `Follow-up: ${meetingTitles.length} meetings`;
  } else {
    const n = eligible.length;
    title = `Follow-up: ${n} action item${n === 1 ? "" : "s"}`;
  }

  const agendaItems = eligible.map((task) => {
    const details = [
      task.owner && task.owner !== "Unassigned" ? `Owner: ${task.owner}` : null,
      task.dueDate
        ? `Due: ${new Date(task.dueDate).toLocaleDateString()}`
        : null,
      task.meetingTitle ? `From: ${task.meetingTitle}` : null,
    ].filter(Boolean);

    return {
      text: task.title,
      description: details.join(" · "),
      id: `source-${task.id}`,
      sourceActionItemId: task.id,
    };
  });

  return {
    title,
    description: `Follow-up meeting generated from ${eligible.length} selected action item(s). Review the agenda below before scheduling.`,
    agendaItems,
    sourceActionItemIds: eligible.map((task) => task.id),
  };
};
