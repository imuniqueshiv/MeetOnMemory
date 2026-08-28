import React from "react";

/**
 * Extracts mention query at current cursor position in text.
 * Triggers when user types `@` or `@someQuery`.
 *
 * @param {string} text
 * @param {number} selectionStart
 * @returns {{ isMentioning: boolean, query: string, mentionIndex: number }}
 */
export function extractMentionQuery(text, selectionStart = 0) {
  if (!text || selectionStart <= 0) {
    return { isMentioning: false, query: "", mentionIndex: -1 };
  }

  const textBeforeCursor = text.substring(0, selectionStart);
  const lastAtIndex = textBeforeCursor.lastIndexOf("@");

  if (lastAtIndex === -1) {
    return { isMentioning: false, query: "", mentionIndex: -1 };
  }

  // Ensure @ is at start of line or preceded by whitespace
  const charBeforeAt =
    lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
  if (!/\s/.test(charBeforeAt) && lastAtIndex !== 0) {
    return { isMentioning: false, query: "", mentionIndex: -1 };
  }

  const query = textBeforeCursor.substring(lastAtIndex + 1);

  // If there are spaces or newlines in query, close mention picker unless query is short
  if (
    query.includes("\n") ||
    (query.includes(" ") && query.split(" ").length > 2)
  ) {
    return { isMentioning: false, query: "", mentionIndex: -1 };
  }

  return {
    isMentioning: true,
    query: query.trim(),
    mentionIndex: lastAtIndex,
  };
}

/**
 * Replaces `@query` at cursor position with selected member mention tag.
 * Format: `@[Member Name](memberId) `
 *
 * @param {string} text
 * @param {number} selectionStart
 * @param {Object} member
 * @returns {{ newText: string, newSelectionStart: number }}
 */
export function insertMention(text, selectionStart, member) {
  const { mentionIndex } = extractMentionQuery(text, selectionStart);
  if (mentionIndex === -1) {
    return { newText: text, newSelectionStart: selectionStart };
  }

  const memberName = member.name || member.username || member.email || "User";
  const memberId = member._id || member.id || memberName;
  const tag = `@[${memberName}](${memberId}) `;

  const beforeTag = text.substring(0, mentionIndex);
  const afterTag = text.substring(selectionStart);
  const newText = `${beforeTag}${tag}${afterTag}`;
  const newSelectionStart = mentionIndex + tag.length;

  return { newText, newSelectionStart };
}

/**
 * Parses text containing mention markup `@[Name](id)` or `@Name`
 * and renders formatted React spans.
 *
 * @param {string} text
 * @returns {React.ReactNode}
 */
export function renderMentions(text) {
  if (!text || typeof text !== "string") return text;

  // Regex to match `@[Name](id)` or standalone `@Name`
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)|@([a-zA-Z0-9._-]+)/g;
  if (!mentionRegex.test(text)) {
    return text;
  }
  mentionRegex.lastIndex = 0;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const matchIndex = match.index;

    // Push preceding text
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    const name = match[1] || match[3];
    const key = `mention-${matchIndex}`;

    parts.push(
      <span
        key={key}
        className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-xs border border-blue-200 dark:border-blue-800/60 transition-colors mx-0.5 select-none"
        title={`Mentioned @${name}`}
      >
        @{name}
      </span>,
    );

    lastIndex = mentionRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
