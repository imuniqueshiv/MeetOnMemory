import React from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
} from "lucide-react";

export default function MeetingControlBar({
  micOn,
  toggleMic,
  cameraOn,
  toggleCamera,
  isScreenSharing,
  toggleScreenShare,
  leaveMeeting,
}) {
  return (
    <div className="h-24 bg-gray-900 border-t border-gray-800 flex items-center justify-center gap-4 px-6 z-20 shrink-0">
      {/* Mic Toggle */}
      <button
        onClick={toggleMic}
        className={`p-4 rounded-full transition-all shadow-md active:scale-95 cursor-pointer ${
          micOn
            ? "bg-gray-800 text-white hover:bg-gray-700"
            : "bg-red-500 text-white hover:bg-red-600"
        }`}
        aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
      >
        {micOn ? <Mic size={22} /> : <MicOff size={22} />}
      </button>

      {/* Camera Toggle */}
      <button
        onClick={toggleCamera}
        className={`p-4 rounded-full transition-all shadow-md active:scale-95 cursor-pointer ${
          cameraOn
            ? "bg-gray-800 text-white hover:bg-gray-700"
            : "bg-red-500 text-white hover:bg-red-600"
        }`}
        aria-label={cameraOn ? "Turn off camera" : "Turn on camera"}
      >
        {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
      </button>

      {/* Screen Share */}
      <button
        onClick={toggleScreenShare}
        className={`p-4 rounded-full transition-all shadow-md active:scale-95 cursor-pointer ${
          isScreenSharing
            ? "bg-indigo-500 text-white hover:bg-indigo-600"
            : "bg-gray-800 text-white hover:bg-gray-700"
        }`}
        aria-label={isScreenSharing ? "Stop screen share" : "Share screen"}
      >
        <MonitorUp size={22} />
      </button>

      <div className="w-px h-8 bg-gray-700 mx-2"></div>

      {/* Leave */}
      <button
        onClick={leaveMeeting}
        className="px-6 py-4 bg-red-600 text-white rounded-full font-semibold hover:bg-red-700 shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
      >
        <PhoneOff size={22} /> Leave
      </button>
    </div>
  );
}
