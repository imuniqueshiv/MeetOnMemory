import React, { useContext } from "react";
import AppContent from "../../context/AppContent.js";
import {
  Clock,
  Users,
  Copy,
  PanelRightClose,
  NotebookPen,
  Captions,
  FileText,
  Lightbulb,
  DoorOpen,
  BarChart3,
  Timer,
  ShieldAlert,
  PenTool,
  BookOpen,
} from "lucide-react";

export default function MeetingHeader({
  roomId,
  duration,
  peers,
  copyLink,
  activePanel,
  onTogglePanel,
  transcriptionEnabled,
  toggleTranscription,
  userRole: propUserRole,
}) {
  const appContext = useContext(AppContent) || {};
  const userData = appContext.userData;
  const userRole = propUserRole || userData?.role || "member";
  const isViewerOrGuest = userRole === "viewer" || userRole === "guest";
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ":" : ""}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isNotesOpen = activePanel === "notes";
  const isParkingLotOpen = activePanel === "parkingLot";
  const isTranscriptOpen = activePanel === "transcript";
  const isBreakoutRoomsOpen = activePanel === "breakoutRooms";
  const isPollsOpen = activePanel === "polls";
  const isAgendaOpen = activePanel === "agenda";
  const isCanvasOpen = activePanel === "canvas";
  const isAttendanceOpen = activePanel === "attendance";
  const isPlaybookOpen = activePanel === "playbook";

  return (
    <header
      role="banner"
      aria-label="Meeting room header"
      className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 z-20 shrink-0"
    >
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-white truncate max-w-xs md:max-w-md">
          Room: {roomId}
        </h2>
        {isViewerOrGuest && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-950/70 border border-amber-600/60 text-amber-300 rounded-full text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            Read-Only ({userRole})
          </span>
        )}
        <div className="flex items-center gap-2 text-gray-300 bg-gray-800 px-3 py-1 rounded-full text-sm font-mono">
          <Clock size={14} />
          <span>{formatTime(duration)}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-300 bg-gray-800 px-3 py-1 rounded-full text-sm">
          <Users size={16} />
          <span>{peers.length + 1}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="text-gray-300 hover:text-white flex items-center gap-1.5 text-sm font-semibold bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl transition-all cursor-pointer"
        >
          <Copy size={16} />
          <span className="hidden sm:inline">Copy Link</span>
        </button>

        {/* Notes Toggle */}
        <button
          type="button"
          onClick={() => onTogglePanel("notes")}
          aria-pressed={isNotesOpen}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
            isNotesOpen
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
          }`}
          title={isNotesOpen ? "Hide notes" : "Open collaborative notes"}
        >
          {isNotesOpen ? (
            <PanelRightClose size={16} />
          ) : (
            <NotebookPen size={16} />
          )}
          <span className="hidden sm:inline">
            {isNotesOpen ? "Hide Notes" : "Notes"}
          </span>
        </button>

        {/* Parking Lot Toggle */}
        <button
          type="button"
          onClick={() => onTogglePanel("parkingLot")}
          aria-pressed={isParkingLotOpen}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
            isParkingLotOpen
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
          }`}
          title={isParkingLotOpen ? "Hide parking lot" : "Open parking lot"}
        >
          <Lightbulb size={16} />
          <span className="hidden sm:inline">
            {isParkingLotOpen ? "Hide Ideas" : "Parking Lot"}
          </span>
        </button>

        {/* Breakout Rooms Toggle (hidden for viewers & guests) */}
        {!isViewerOrGuest && (
          <button
            type="button"
            onClick={() => onTogglePanel("breakoutRooms")}
            aria-pressed={isBreakoutRoomsOpen}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
              isBreakoutRoomsOpen
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
            }`}
            title={
              isBreakoutRoomsOpen
                ? "Hide breakout rooms"
                : "Open breakout rooms"
            }
          >
            <DoorOpen size={16} />
            <span className="hidden sm:inline">
              {isBreakoutRoomsOpen ? "Hide Breakout" : "Breakout"}
            </span>
          </button>
        )}

        {/* Polls Toggle */}
        <button
          type="button"
          onClick={() => onTogglePanel("polls")}
          aria-pressed={isPollsOpen}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
            isPollsOpen
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
          }`}
          title={isPollsOpen ? "Hide live polls" : "Open live polls"}
        >
          <BarChart3 size={16} />
          <span className="hidden sm:inline">
            {isPollsOpen ? "Hide Polls" : "Polls"}
          </span>
        </button>

        {/* Agenda Timer Toggle */}
        <button
          type="button"
          onClick={() => onTogglePanel("agenda")}
          aria-pressed={isAgendaOpen}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
            isAgendaOpen
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
          }`}
          title={isAgendaOpen ? "Hide live agenda" : "Open live agenda"}
        >
          <Timer size={16} />
          <span className="hidden sm:inline">
            {isAgendaOpen ? "Hide Agenda" : "Agenda"}
          </span>
        </button>

        {/* Playbook Guidance Toggle */}
        <button
          type="button"
          onClick={() => onTogglePanel("playbook")}
          aria-pressed={isPlaybookOpen}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
            isPlaybookOpen
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
          }`}
          title={
            isPlaybookOpen ? "Hide playbook guidance" : "Open playbook guidance"
          }
        >
          <BookOpen size={16} />
          <span className="hidden sm:inline">
            {isPlaybookOpen ? "Hide Playbook" : "Playbook"}
          </span>
        </button>

        {/* Canvas Toggle */}
        <button
          type="button"
          onClick={() => onTogglePanel("canvas")}
          aria-pressed={isCanvasOpen}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
            isCanvasOpen
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
          }`}
          title={
            isCanvasOpen ? "Hide whiteboard" : "Open collaborative whiteboard"
          }
        >
          <PenTool size={16} />
          <span className="hidden sm:inline">
            {isCanvasOpen ? "Hide Canvas" : "Canvas"}
          </span>
        </button>

        {/* Attendance Toggle */}
        <button
          type="button"
          onClick={() => onTogglePanel("attendance")}
          aria-pressed={isAttendanceOpen}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
            isAttendanceOpen
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
          }`}
          title={isAttendanceOpen ? "Hide attendance" : "Show attendance"}
        >
          <Users size={16} />
          <span className="hidden sm:inline">
            {isAttendanceOpen ? "Hide Attendance" : "Attendance"}
          </span>
        </button>

        {/* Transcription Toggle (gated to non-viewer/guest) */}
        {!isViewerOrGuest ? (
          <button
            type="button"
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
        ) : (
          <div
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-gray-800/50 text-gray-500 cursor-not-allowed select-none"
            title="Transcription controls restricted to hosts and members"
          >
            <Captions size={16} className="opacity-50" />
            <span className="hidden sm:inline">Captions</span>
          </div>
        )}

        {/* Transcript Toggle */}
        <button
          type="button"
          onClick={() => onTogglePanel("transcript")}
          aria-pressed={isTranscriptOpen}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
            isTranscriptOpen
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
          }`}
          title={isTranscriptOpen ? "Hide transcript" : "Show transcript"}
        >
          <FileText size={16} />
          <span className="hidden sm:inline">
            {isTranscriptOpen ? "Hide" : "Transcript"}
          </span>
        </button>
      </div>
    </header>
  );
}
