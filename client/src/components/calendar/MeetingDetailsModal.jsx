import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Briefcase,
  Layers,
  MapPin,
  Video,
  ExternalLink,
  X,
} from "lucide-react";
import { getStatusStyle, formatTimeSlot } from "./calendarUtils";

const MeetingDetailsModal = ({ selectedMeeting, setSelectedMeeting }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedMeeting(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedMeeting]);

  if (!selectedMeeting) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
      onClick={() => setSelectedMeeting(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-6 relative overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={() => setSelectedMeeting(null)}
          className="absolute right-4 top-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header info */}
        <div className="mb-5 pr-6">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-2 border ${getStatusStyle(selectedMeeting.status).badge}`}
          >
            {selectedMeeting.status}
          </span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
            {selectedMeeting.title}
          </h3>
        </div>

        {/* Detail rows */}
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 border-t border-b border-slate-100 dark:border-slate-700 py-4 mb-5">
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-100">
                {new Date(selectedMeeting.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase mt-0.5">
                {formatTimeSlot(selectedMeeting.time)} (
                {selectedMeeting.duration || 60} mins)
              </div>
            </div>
          </div>

          {selectedMeeting.organization && (
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  Organization:
                </span>{" "}
                {selectedMeeting.organization.name ||
                  selectedMeeting.organization}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Layers className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                Type:
              </span>{" "}
              <span className="capitalize">
                {selectedMeeting.meetingType || "Conference"}
              </span>
            </div>
          </div>

          {selectedMeeting.location && (
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  Location:
                </span>{" "}
                {selectedMeeting.location}
              </div>
            </div>
          )}

          {selectedMeeting.description && (
            <div className="pt-2">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                Description
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700">
                {selectedMeeting.description}
              </p>
            </div>
          )}
        </div>

        {/* Quick Actions buttons */}
        <div className="flex justify-end gap-3">
          {selectedMeeting.recordingType === "live" &&
            selectedMeeting.status !== "failed" && (
              <button
                onClick={() => {
                  setSelectedMeeting(null);
                  navigate("/meeting-room");
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Video className="w-3.5 h-3.5" />
                Join Live Room
              </button>
            )}
          <button
            onClick={() => {
              setSelectedMeeting(null);
              navigate(`/meeting/${selectedMeeting._id}`);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View full details
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingDetailsModal;
