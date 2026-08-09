import React, { useState } from "react";
import {
  Calendar,
  Clock,
  FileText,
  Tag,
  Trash2,
  Download,
  Edit2,
  Eye,
  MoreVertical,
} from "lucide-react";

import useExport from "../../hooks/useExport.js";
import ConfirmModal from "../ConfirmModal.jsx";

const MeetingCard = ({ meeting, onDelete, onRename, onView }) => {
  const { exportMeeting, isExporting } = useExport();
  const [showMenu, setShowMenu] = useState(false);
  const [showExportSubMenu, setShowExportSubMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(meeting.title);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    if (newTitle.trim() && newTitle !== meeting.title) {
      onRename(meeting._id, newTitle.trim());
    }
    setIsRenaming(false);
    setNewTitle(meeting.title);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-700 dark:bg-green-950/70 dark:text-green-300 border border-green-200 dark:border-green-800";
      case "processing":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/70 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800";
      case "failed":
        return "bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700";
    }
  };

  return (
    <div
      data-testid="meeting-card"
      className="bg-white dark:bg-gray-900 rounded-xl shadow-md hover:shadow-lg dark:shadow-none dark:hover:shadow-none transition-shadow duration-200 overflow-hidden border border-gray-100 dark:border-gray-800"
    >
      {/* Card Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between gap-3">
          {isRenaming ? (
            <form onSubmit={handleRenameSubmit} className="flex-1">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onBlur={() => {
                  setIsRenaming(false);
                  setNewTitle(meeting.title);
                }}
                autoFocus
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
              />
            </form>
          ) : (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2 flex-1">
              {meeting.title || "Untitled Meeting"}
            </h3>
          )}
          <div className="relative">
            <button
              onClick={() => {
                setShowMenu(!showMenu);
                setShowExportSubMenu(false);
              }}
              aria-label="Meeting actions"
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <MoreVertical
                size={18}
                className="text-gray-500 dark:text-gray-400"
              />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10 min-w-[160px] text-gray-700 dark:text-gray-200">
                <button
                  onClick={() => {
                    setIsRenaming(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-sm"
                >
                  <Edit2
                    size={16}
                    className="text-gray-500 dark:text-gray-400"
                  />
                  Rename
                </button>
                <div
                  className="relative"
                  onMouseEnter={() => setShowExportSubMenu(true)}
                  onMouseLeave={() => setShowExportSubMenu(false)}
                >
                  <button
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isExporting}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowExportSubMenu(!showExportSubMenu);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Download
                        size={16}
                        className="text-gray-500 dark:text-gray-400"
                      />
                      {isExporting ? "Exporting..." : "Export"}
                    </div>
                    {!isExporting && (
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${showExportSubMenu ? "rotate-90" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </button>

                  {showExportSubMenu && (
                    <div className="absolute right-full top-0 mr-1 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 min-w-[140px]">
                      <button
                        onClick={() => {
                          exportMeeting(meeting, "pdf");
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-sm"
                      >
                        Export as PDF
                      </button>
                      <button
                        onClick={() => {
                          exportMeeting(meeting, "docx");
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-sm"
                      >
                        Export as DOCX
                      </button>
                      <button
                        onClick={() => {
                          exportMeeting(meeting, "md");
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-sm"
                      >
                        Export as MD
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setShowDeleteModal(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2 text-sm"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(meeting.status)}`}
          >
            {meeting.status || "Unknown"}
          </span>
          {meeting.meetingType && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-100 dark:border-blue-800 rounded-full text-xs font-medium">
              {meeting.meetingType}
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 space-y-3">
        {/* Date and Duration */}
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
            <span>{formatDate(meeting.date || meeting.createdAt)}</span>
          </div>
          {meeting.duration && (
            <div className="flex items-center gap-1.5">
              <Clock size={16} className="text-gray-400 dark:text-gray-500" />
              <span>{meeting.duration} min</span>
            </div>
          )}
        </div>

        {/* Summary Preview */}
        {meeting.summary && (
          <div className="flex items-start gap-2">
            <FileText
              size={16}
              className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
              {meeting.summary}
            </p>
          </div>
        )}

        {/* Tags */}
        {meeting.tags && meeting.tags.length > 0 && (
          <div className="flex items-start gap-2">
            <Tag
              size={16}
              className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0"
            />
            <div className="flex flex-wrap gap-1.5">
              {meeting.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
              {meeting.tags.length > 3 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 rounded text-xs">
                  +{meeting.tags.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Participants */}
        {meeting.participants && meeting.participants.length > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {meeting.participants.length}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {" "}
              participant(s)
            </span>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Created {formatDate(meeting.createdAt)}
        </span>
        <button
          onClick={() => onView(meeting)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1"
        >
          <Eye size={16} />
          View Details
        </button>
      </div>
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          onDelete(meeting._id);
          setShowDeleteModal(false);
        }}
        title="Delete Meeting Notes"
        message={`Are you sure you want to delete "${meeting.title || "this meeting"}"? All associated notes, transcripts, and summaries will be permanently deleted.`}
      />
    </div>
  );
};

export default MeetingCard;
