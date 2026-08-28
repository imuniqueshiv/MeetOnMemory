import React, { useState } from "react";
import {
  Tag,
  ExternalLink,
  CalendarPlus,
  Trash2,
  Copy,
  Check,
  Building2,
  Sparkles,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";

const GeneratedSessionCards = ({
  generatedSessions = [],
  onDeleteSession,
  onReuseSession,
}) => {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState(null);

  if (generatedSessions.length === 0) return null;

  const handleCopySummary = (session, id) => {
    const textToCopy = `Session: ${session.sessionTitle}\nEvent: ${session.eventName || "N/A"}\nSpeaker: ${session.speaker || "N/A"}\n\nSummary:\n${session.summary || ""}\n\nKeywords: ${(session.keywords || []).join(", ")}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    toast.success("Session details copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleReuse = (session) => {
    if (onReuseSession) {
      onReuseSession(session);
    } else {
      const params = new URLSearchParams();
      if (session._id || session.id) {
        params.set("fromSessionCard", session._id || session.id);
      }
      navigate(`/create-meeting?${params.toString()}`);
    }
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles
            className="text-purple-600 dark:text-purple-400"
            size={20}
          />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Saved & Generated Session Cards ({generatedSessions.length})
          </h3>
        </div>
        <Link
          to="/session-cards"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 hover:underline"
        >
          <Building2 size={14} />
          <span>View Org Gallery</span>
        </Link>
      </div>

      <div className="space-y-4">
        {generatedSessions.map((session, index) => {
          const cardId = session._id || session.id || `session-${index}`;
          return (
            <div
              key={cardId}
              className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/40 dark:to-blue-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-6 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-3 gap-4">
                <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                    {session.sessionTitle}
                  </h4>
                  {session.eventName && (
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      {session.eventName}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full">
                    Session Card
                  </span>
                  {onDeleteSession && (session._id || session.id) && (
                    <button
                      type="button"
                      onClick={() => onDeleteSession(session._id || session.id)}
                      title="Delete session card"
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-white/80 dark:hover:bg-gray-800 transition"
                      aria-label="Delete session card"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {session.speaker && (
                <div className="mb-3 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {session.speaker}
                  </p>
                  {session.speakerTitle && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {session.speakerTitle}
                    </p>
                  )}
                  {session.speakerBio && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                      {session.speakerBio}
                    </p>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                {session.summary || "AI-generated summary will appear here..."}
              </p>

              {session.keywords && session.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {session.keywords.map((keyword, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 text-xs rounded-full flex items-center gap-1 font-medium"
                    >
                      <Tag size={11} /> {keyword}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-purple-200/60 dark:border-purple-800/60">
                <div className="flex items-center gap-3">
                  {session.videoUrl && (
                    <a
                      href={session.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                    >
                      <ExternalLink size={14} /> Watch Video
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopySummary(session, cardId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-xs font-medium rounded-lg transition cursor-pointer"
                  >
                    {copiedId === cardId ? (
                      <>
                        <Check size={13} className="text-emerald-500" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy Details</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReuse(session)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
                  >
                    <CalendarPlus size={13} />
                    <span>Use as Meeting Draft</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GeneratedSessionCards;
