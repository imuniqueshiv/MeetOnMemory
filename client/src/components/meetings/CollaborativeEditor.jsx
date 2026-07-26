import React, { useContext, useRef } from "react";
import {
  Users,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  FileText,
} from "lucide-react";
import useCollaborativeDoc from "../../hooks/useCollaborativeDoc.js";
import AppContent from "../../context/AppContent.js";

// Color palette for user presence dots
const PRESENCE_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
];

const CollaborativeEditor = ({ meetingId }) => {
  const { backendUrl, userData } = useContext(AppContent);
  const textareaRef = useRef(null);

  const { content, setContent, connectedUsers, isSynced, isConnected } =
    useCollaborativeDoc(meetingId, backendUrl);

  const handleChange = (e) => {
    setContent(e.target.value);
  };

  // Render N fake presence dots (simplified — no real user map yet)
  const presenceDots = Array.from({ length: Math.min(connectedUsers, 5) }).map(
    (_, i) => (
      <div
        key={i}
        title={i === 0 ? userData?.name || "You" : `Collaborator ${i + 1}`}
        className={`w-7 h-7 rounded-full ${PRESENCE_COLORS[i % PRESENCE_COLORS.length]} border-2 border-gray-900 flex items-center justify-center text-white text-xs font-bold -ml-1 first:ml-0 shadow-md`}
      >
        {i === 0
          ? (userData?.name?.[0] || "Y").toUpperCase()
          : String.fromCharCode(65 + i)}
      </div>
    ),
  );

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        {/* Left: title + icon */}
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-indigo-400" />
          <span className="text-sm font-semibold text-gray-200">
            Collaborative Notes
          </span>
          {/* Sync status */}
          {!isSynced ? (
            <span className="flex items-center gap-1 text-xs text-amber-400 ml-2">
              <Loader2 size={12} className="animate-spin" />
              Syncing…
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-emerald-400 ml-2">
              <CheckCircle2 size={12} />
              Live
            </span>
          )}
        </div>

        {/* Right: connection status + presence avatars */}
        <div className="flex items-center gap-3">
          {/* Connected users avatars */}
          {connectedUsers > 0 && (
            <div className="flex items-center">
              {presenceDots}
              {connectedUsers > 5 && (
                <span className="text-xs text-gray-400 ml-2">
                  +{connectedUsers - 5}
                </span>
              )}
            </div>
          )}

          {/* Connection indicator */}
          <div
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              isConnected
                ? "bg-emerald-900/40 text-emerald-400"
                : "bg-red-900/40 text-red-400"
            }`}
          >
            {isConnected ? (
              <>
                <Wifi size={11} />
                <span>Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={11} />
                <span>Reconnecting…</span>
              </>
            )}
          </div>

          {/* User count badge */}
          <div className="flex items-center gap-1 bg-gray-800 px-2 py-1 rounded-full text-xs text-gray-300">
            <Users size={11} />
            <span>{connectedUsers}</span>
          </div>
        </div>
      </div>

      {/* ── Editor Area ── */}
      <div className="relative flex-1 min-h-0">
        {/* Loading overlay before initial sync */}
        {!isSynced && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 z-10 gap-3">
            <Loader2 size={28} className="animate-spin text-indigo-500" />
            <p className="text-sm text-gray-400">Loading document…</p>
          </div>
        )}

        <textarea
          ref={textareaRef}
          id={`collab-editor-${meetingId}`}
          className="w-full h-full resize-none bg-gray-950 text-gray-100 text-sm leading-relaxed p-5 outline-none placeholder-gray-700 font-mono scrollbar-thin scrollbar-thumb-gray-800"
          placeholder={
            isSynced
              ? "Start typing collaborative notes here… Changes are synced live to all participants."
              : ""
          }
          value={content}
          onChange={handleChange}
          disabled={!isSynced || !isConnected}
          spellCheck={true}
          autoCapitalize="sentences"
        />

        {/* Character / word count footer */}
        <div className="absolute bottom-3 right-4 text-xs text-gray-600 pointer-events-none select-none">
          {content.length} chars ·{" "}
          {content.trim() ? content.trim().split(/\s+/).length : 0} words
        </div>
      </div>
    </div>
  );
};

export default CollaborativeEditor;
