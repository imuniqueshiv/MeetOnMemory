import React, { useState, useEffect, useContext } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import AppContent from "../../context/AppContent.js";
import CalendarSyncBadge from "../CalendarSyncBadge.jsx";
import {
  Share2,
  Presentation,
  Bookmark,
  MessageSquare,
  Link2,
  BellOff,
  Bell,
  ShieldAlert,
} from "lucide-react";
import { toast } from "react-toastify";
import { toggleBookmarkAPI, getBookmarkStatusAPI } from "../../api/bookmarkApi";
import { askAssistantAbout } from "../../utils/askAssistant.js";
import { notificationApi } from "../../services/notificationApi.js";
import {
  generateICS,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
} from "../../utils/calendarExport.js";

const MeetingHeader = ({ meeting, onShare, onShareInvite, onPresent }) => {
  const navigate = useNavigate();
  const { userData } = useContext(AppContent) || {};
  const isViewerOrGuest =
    userData?.role === "viewer" || userData?.role === "guest";
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoadingBookmark, setIsLoadingBookmark] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [muteLoading, setMuteLoading] = useState(false);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);

  useEffect(() => {
    if (meeting?._id) {
      getBookmarkStatusAPI(meeting._id)
        .then((data) => {
          setIsBookmarked(data.bookmarked);
        })
        .catch((err) => console.error("Error fetching bookmark status:", err));

      notificationApi
        .getPreferences()
        .then(({ data }) => {
          const muted = (data?.preferences?.mutedMeetingIds || []).map(String);
          setIsMuted(muted.includes(String(meeting._id)));
        })
        .catch(() => {
          // Mute state is best-effort
        });
    }
  }, [meeting]);

  const handleToggleBookmark = async () => {
    if (!meeting?._id) return;
    setIsLoadingBookmark(true);
    try {
      const data = await toggleBookmarkAPI(meeting._id);
      setIsBookmarked(data.bookmarked);
      toast.success(data.message);
    } catch (error) {
      console.error(error);
      toast.error("Failed to toggle bookmark");
    } finally {
      setIsLoadingBookmark(false);
    }
  };

  const handleToggleMute = async () => {
    if (!meeting?._id) return;
    setMuteLoading(true);
    try {
      if (isMuted) {
        await notificationApi.unmuteMeeting(meeting._id);
        setIsMuted(false);
        toast.success("Meeting notifications unmuted");
      } else {
        await notificationApi.muteMeeting(meeting._id);
        setIsMuted(true);
        toast.success("Meeting notifications muted");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to update meeting mute");
    } finally {
      setMuteLoading(false);
    }
  };

  if (!meeting) return null;

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch {
      return "N/A";
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "N/A";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
      case "processing":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
      case "uploaded":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {meeting.title || "Untitled Meeting"}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
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
              {formatDate(meeting.date)}
            </span>
            <span className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {formatDuration(meeting.duration)}
            </span>
            <span className="flex items-center gap-1">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              {meeting.meetingType || "conference"}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {isViewerOrGuest && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 rounded-full text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Read-Only {userData?.role ? `(${userData.role})` : ""}
            </span>
          )}
          <CalendarSyncBadge
            externalCalendarRefs={meeting.externalCalendarRefs}
          />
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(meeting.status)}`}
          >
            {meeting.status || "uploaded"}
          </span>
          <button
            onClick={handleToggleBookmark}
            disabled={isLoadingBookmark}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isBookmarked
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <Bookmark
              className="w-4 h-4"
              fill={isBookmarked ? "currentColor" : "none"}
            />
            {isBookmarked ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleToggleMute}
            disabled={muteLoading}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isMuted
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
            aria-pressed={isMuted}
            title={
              isMuted
                ? "Unmute notifications for this meeting"
                : "Mute notifications for this meeting"
            }
          >
            {isMuted ? (
              <BellOff className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            {isMuted ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={onPresent}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 rounded-lg text-sm font-medium transition-colors"
          >
            <Presentation className="w-4 h-4" /> Present
          </button>
          <button
            type="button"
            onClick={() =>
              askAssistantAbout(navigate, {
                type: "meeting",
                refId: meeting._id,
                title: meeting.title || "Untitled Meeting",
              })
            }
            className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50 rounded-lg text-sm font-medium transition-colors"
          >
            <MessageSquare className="w-4 h-4" /> Ask Assistant
          </button>
          {!isViewerOrGuest && onShareInvite && (
            <button
              onClick={onShareInvite}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 rounded-lg text-sm font-medium transition-colors"
            >
              <Link2 className="w-4 h-4" /> Share Invite
            </button>
          )}
          <button
            onClick={onShare}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-lg text-sm font-medium transition-colors"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
          <div className="relative">
            <button
              onClick={() => setShowCalendarMenu(!showCalendarMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              <svg
                className="w-4 h-4"
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
              Add to Calendar
            </button>
            {showCalendarMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 overflow-hidden">
                <button
                  onClick={() => {
                    setShowCalendarMenu(false);
                    generateICS(meeting);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Download ICS
                </button>
                <a
                  href={getGoogleCalendarUrl(meeting)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowCalendarMenu(false)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Google Calendar
                </a>
                <a
                  href={getOutlookCalendarUrl(meeting)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowCalendarMenu(false)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Outlook Web
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {meeting.description && (
        <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm">
          {meeting.description}
        </p>
      )}
    </div>
  );
};

export default MeetingHeader;
