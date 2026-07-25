import React from "react";
import {
  Clock,
  Users,
  Copy,
  PanelRightClose,
  NotebookPen,
  Captions,
  FileText,
} from "lucide-react";

export default function MeetingHeader({
  roomId,
  duration,
  peers,
  copyLink,
  showNotes,
  setShowNotes,
  transcriptionEnabled,
  toggleTranscription,
  showTranscript,
  setShowTranscript,
}) {
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ":" : ""}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 z-20 shrink-0">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-white truncate max-w-xs md:max-w-md">
          Room: {roomId}
        </h2>
        <div className="flex items-center gap-2 text-gray-300 bg-gray-800 px-3 py-1 rounded-full text-sm font-mono">
          <Clock size={14} />
          <span>{formatTime(duration)}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-300 bg-gray-800 px-3 py-1 rounded-full text-sm">
          <Users size={16} />
          <span>{peers.length + 1}</span>
        </div>
      </div>

      <button
        onClick={copyLink}
        className="text-gray-300 hover:text-white flex items-center gap-1.5 text-sm font-semibold bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl transition-all cursor-pointer"
      >
        <Copy size={16} />
        <span className="hidden sm:inline">Copy Link</span>
      </button>

      {/* Notes Toggle */}
      <button
        onClick={() => setShowNotes((v) => !v)}
        className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
          showNotes
            ? "bg-indigo-600 text-white hover:bg-indigo-700"
            : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
        }`}
        title={showNotes ? "Hide notes" : "Open collaborative notes"}
      >
        {showNotes ? <PanelRightClose size={16} /> : <NotebookPen size={16} />}
        <span className="hidden sm:inline">
          {showNotes ? "Hide Notes" : "Notes"}
        </span>
      </button>

      {/* Transcription Toggle */}
      <button
        onClick={toggleTranscription}
        className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
          transcriptionEnabled
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
        }`}
        title={
          transcriptionEnabled
            ? "Stop transcription"
            : "Start live transcription"
        }
      >
        <Captions size={16} />
        <span className="hidden sm:inline">
          {transcriptionEnabled ? "Stop" : "Captions"}
        </span>
      </button>

      {/* Transcript Toggle */}
      <button
        onClick={() => setShowTranscript((v) => !v)}
        className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
          showTranscript
            ? "bg-indigo-600 text-white hover:bg-indigo-700"
            : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
        }`}
        title={showTranscript ? "Hide transcript" : "Show transcript"}
      >
        <FileText size={16} />
        <span className="hidden sm:inline">
          {showTranscript ? "Hide" : "Transcript"}
        </span>
      </button>
    </div>
  );
}
