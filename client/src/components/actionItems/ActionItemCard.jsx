import React, { useState, useRef } from "react";
import GitHubSyncBadge from "./GitHubSyncBadge.jsx";
import JiraSyncBadge from "./JiraSyncBadge.jsx";
import LinearSyncBadge from "./LinearSyncBadge.jsx";
import MentionPicker from "../mentions/MentionPicker.jsx";
import {
  extractMentionQuery,
  insertMention,
  renderMentions,
} from "../../utils/mentionUtils.jsx";
import { MessageSquare } from "lucide-react";

/**
 * @desc Individual card component for an action item in the Kanban board.
 * Displays title, assignee, deadline, notes, and quick actions to change status.
 */
const ActionItemCard = ({ item, onStatusChange, members = [], onAddNote }) => {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [activeMention, setActiveMention] = useState({
    isMentioning: false,
    query: "",
  });
  const noteRef = useRef(null);

  const priorityColors = {
    low: "text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-300",
    medium: "text-blue-700 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300",
    high: "text-orange-700 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-300",
    urgent: "text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300",
  };

  const isOverdue =
    item.status === "overdue" ||
    (item.deadline &&
      new Date(item.deadline) < new Date() &&
      item.status !== "completed");

  const handleNoteChange = (e) => {
    const val = e.target.value;
    setNoteText(val);
    const mentionData = extractMentionQuery(val, e.target.selectionStart);
    setActiveMention(mentionData);
  };

  const handleSelectMember = (member) => {
    const pos = noteRef.current?.selectionStart || noteText.length;
    const { newText } = insertMention(noteText, pos, member);
    setNoteText(newText);
    setActiveMention({ isMentioning: false, query: "" });
  };

  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    if (onAddNote) {
      onAddNote(item._id, noteText);
    }
    setNoteText("");
    setShowNoteInput(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-all group relative">
      <div className="flex items-start justify-between mb-2">
        <span
          className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${priorityColors[item.priority || "low"]}`}
        >
          {item.priority || "low"}
        </span>
        {item.aiConfidence < 1 && (
          <span
            className="text-[10px] text-purple-600 dark:text-purple-400 font-medium"
            title="AI Extracted"
          >
            AI ({Math.round((item.aiConfidence || 0) * 100)}%)
          </span>
        )}
      </div>

      <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-2 line-clamp-2">
        {renderMentions(item.title)}
      </h4>

      {item.description && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {renderMentions(item.description)}
        </div>
      )}

      {item.notes && item.notes.length > 0 && (
        <div className="mb-3 space-y-1 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-800 text-xs">
          {item.notes.map((note, idx) => (
            <div
              key={idx}
              className="text-slate-600 dark:text-slate-300 text-[11px]"
            >
              💬 {renderMentions(typeof note === "string" ? note : note.text)}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
        <div className="flex items-center gap-1.5">
          {item.assignee?.avatar ? (
            <img
              src={item.assignee.avatar}
              alt=""
              className="w-5 h-5 rounded-full"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
              {item.assignee?.name?.charAt(0) || "?"}
            </div>
          )}
          <span className="truncate max-w-[80px]">
            {item.assignee?.name || "Unassigned"}
          </span>
        </div>

        {item.deadline && (
          <div
            className={`flex items-center gap-1 ${isOverdue ? "text-red-600 dark:text-red-400 font-bold" : ""}`}
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {new Date(item.deadline).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        <GitHubSyncBadge
          issueId={item.externalGitHubIssueId}
          issueUrl={item.externalGitHubIssueUrl}
        />
        <JiraSyncBadge
          issueId={item.externalJiraIssueId}
          issueUrl={item.externalJiraIssueUrl}
        />
        <LinearSyncBadge
          issueId={item.externalLinearIssueId}
          issueUrl={item.externalLinearIssueUrl}
        />
      </div>

      {showNoteInput && (
        <div className="mt-2 space-y-2 relative">
          <textarea
            ref={noteRef}
            value={noteText}
            onChange={handleNoteChange}
            placeholder="Add a note... Use @ to mention"
            className="w-full p-2 text-xs border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
            rows={2}
          />
          {activeMention.isMentioning && (
            <MentionPicker
              isOpen={true}
              query={activeMention.query}
              members={members}
              onSelect={handleSelectMember}
              onClose={() =>
                setActiveMention({ isMentioning: false, query: "" })
              }
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSaveNote}
              className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 cursor-pointer"
            >
              Save Note
            </button>
            <button
              onClick={() => {
                setShowNoteInput(false);
                setNoteText("");
              }}
              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold rounded cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-2 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={() => setShowNoteInput(!showNoteInput)}
          className="flex-1 py-1 text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center justify-center gap-1 cursor-pointer"
        >
          <MessageSquare className="w-3 h-3" />
          Note
        </button>
        {item.status !== "completed" && onStatusChange && (
          <button
            onClick={() => onStatusChange(item._id, "completed")}
            className="flex-1 py-1 text-[10px] font-bold text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors cursor-pointer"
          >
            Complete
          </button>
        )}
        {item.status === "pending" && onStatusChange && (
          <button
            onClick={() => onStatusChange(item._id, "in_progress")}
            className="flex-1 py-1 text-[10px] font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors cursor-pointer"
          >
            Start
          </button>
        )}
      </div>
    </div>
  );
};

export default ActionItemCard;
