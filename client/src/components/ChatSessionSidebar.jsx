import React, { useState } from "react";
import {
  Plus,
  Trash2,
  MessageSquare,
  Search,
  X,
  ChevronDown,
} from "lucide-react";

/**
 * ChatSessionSidebar - Optimized sidebar for AI Assistant workspace
 * Features:
 * - Compact design with 14rem width (reduced from 18rem)
 * - Search functionality for quick session navigation
 * - Collapsible sections for better space utilization
 * - Improved visual hierarchy and spacing
 * - Clean non-nested interactive HTML structure for accessibility (#1229)
 */
const ChatSessionSidebar = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Filter sessions based on search query
  const filteredSessions = sessions.filter((session) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.title?.toLowerCase().includes(query) ||
      session.id?.toLowerCase().includes(query)
    );
  });

  // Group sessions by date for better organization
  const groupSessionsByDate = (sessions) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const groups = {
      today: [],
      yesterday: [],
      lastWeek: [],
      older: [],
    };

    sessions.forEach((session) => {
      const sessionDate = new Date(session.updatedAt || session.createdAt);

      if (sessionDate >= today) {
        groups.today.push(session);
      } else if (sessionDate >= yesterday) {
        groups.yesterday.push(session);
      } else if (sessionDate >= lastWeek) {
        groups.lastWeek.push(session);
      } else {
        groups.older.push(session);
      }
    });

    return groups;
  };

  const groupedSessions = groupSessionsByDate(filteredSessions);

  /**
   * Render session item with clean non-nested interactive elements (#1229)
   */
  const SessionItem = ({ session }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectSession(session.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectSession(session.id);
        }
      }}
      className={`group relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-all duration-150 cursor-pointer ${
        currentSessionId === session.id
          ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100"
          : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/70"
      }`}
    >
      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <span className="flex-1 truncate font-medium">
        {session.title || "Untitled Chat"}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (
            window.confirm("Are you sure you want to delete this conversation?")
          ) {
            onDeleteSession(session.id);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
          }
        }}
        className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 cursor-pointer"
        aria-label="Delete conversation"
        title="Delete conversation"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );

  /**
   * Render session group with collapsible header
   */
  const SessionGroup = ({ title, sessions }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    if (sessions.length === 0) return null;

    return (
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 cursor-pointer"
        >
          <span>{title}</span>
          <ChevronDown
            className={`h-3 w-3 transition-transform ${
              isExpanded ? "rotate-0" : "-rotate-90"
            }`}
          />
        </button>
        {isExpanded && (
          <div className="mt-1 space-y-0.5">
            {sessions.map((session) => (
              <SessionItem key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full w-56 flex-col border-r border-gray-200 bg-gradient-to-b from-gray-50 to-gray-100/50 dark:border-gray-700 dark:from-gray-800/80 dark:to-gray-900/80">
      {/* Header with search and new chat button */}
      <div className="border-b border-gray-200 bg-white/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onNewSession}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 cursor-pointer"
            aria-label="Start new chat"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className={`rounded-lg p-1.5 transition cursor-pointer ${
              showSearch
                ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
                : "text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
            aria-label="Search conversations"
            title="Search"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Search input */}
        {showSearch && (
          <div className="mt-2 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 pr-8 text-xs placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sessions list with scrollable area */}
      <div className="custom-scrollbar flex-1 overflow-y-auto px-2 py-3">
        {filteredSessions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <MessageSquare className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {searchQuery ? "No conversations match" : "No conversations yet"}
            </p>
            {!searchQuery && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Start a new chat to begin
              </p>
            )}
          </div>
        ) : (
          <>
            <SessionGroup title="Today" sessions={groupedSessions.today} />
            <SessionGroup
              title="Yesterday"
              sessions={groupedSessions.yesterday}
            />
            <SessionGroup
              title="Last 7 Days"
              sessions={groupedSessions.lastWeek}
            />
            <SessionGroup title="Older" sessions={groupedSessions.older} />
          </>
        )}
      </div>

      {/* Footer with session count */}
      {sessions.length > 0 && (
        <div className="border-t border-gray-200 bg-white/50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            {sessions.length} {sessions.length === 1 ? "chat" : "chats"} total
          </p>
        </div>
      )}
    </div>
  );
};

export default ChatSessionSidebar;
