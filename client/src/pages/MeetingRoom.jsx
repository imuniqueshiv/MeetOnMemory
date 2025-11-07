// MeetingRoom.jsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Mic,
  MicOff,
  PhoneOff,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const MeetingRoom = () => {
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const socket = useRef(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  // ✅ Proper meeting join flow
  const joinMeeting = async () => {
    try {
      setLoading(true);

      // Ask for permissions (user gesture context)
      const userStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Store the stream for persistence
      streamRef.current = userStream;

      // Wait for the video element to render before attaching
      setJoined(true);

      // Small delay to ensure <video> ref exists in DOM
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = userStream;
        }
      }, 100);

      // Connect socket only after successful media access
      socket.current = io(backendUrl, { transports: ["websocket"] });
      socket.current.emit("join-meeting", { roomId: "demo-room" });

      // Simulate loading animation
      setTimeout(() => setLoading(false), 1000);
    } catch (err) {
      console.error("Camera/Mic access denied:", err);
      alert("❌ Camera or microphone access denied. Please enable them and retry.");
      setLoading(false);
    }
  };

  // ✅ Leave meeting properly
  const leaveMeeting = () => {
    setMeetingEnded(true);

    // Stop media tracks
    streamRef.current?.getTracks().forEach((track) => track.stop());

    // Disconnect socket
    socket.current?.disconnect();

    setJoined(false);

    // Simulate AI processing
    setTimeout(() => {
      setMeetingEnded(false);
      alert(
        "✅ Transcript and MoM generated successfully!\nEmail has been sent to your registered account."
      );
    }, 4000);
  };

  // ✅ Handle mic toggle
  useEffect(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = micOn;
    }
  }, [micOn]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-100 relative overflow-hidden text-center">

      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-indigo-200 opacity-20 blur-3xl rounded-full animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-200 opacity-30 blur-3xl rounded-full animate-pulse"></div>

      {/* ---------- INTRO SCREEN ---------- */}
      {!joined && !meetingEnded && (
        <div className="relative z-10 px-6 md:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 mb-3 flex items-center justify-center gap-3">
            🎥 MeetOnMemory{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              Live Room
            </span>
          </h1>

          <p className="text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed text-base md:text-lg">
            Join live meetings with{" "}
            <strong className="text-indigo-700 font-semibold">
              real-time transcription
            </strong>{" "}
            and{" "}
            <strong className="text-indigo-700 font-semibold">
              automatic AI-generated MoMs
            </strong>{" "}
            — delivered straight to your inbox after completion.
          </p>

          {loading ? (
            <button
              disabled
              className="px-8 py-3 bg-indigo-600 text-white rounded-full font-semibold shadow-md flex items-center justify-center gap-2 mx-auto cursor-not-allowed"
            >
              <Loader2 className="animate-spin" size={20} /> Connecting...
            </button>
          ) : (
            <button
              onClick={joinMeeting}
              className="px-8 py-3 bg-indigo-600 text-white rounded-full font-semibold shadow-md hover:bg-indigo-700 hover:shadow-xl active:scale-95 transition-all duration-300"
            >
              🚀 Join Meeting
            </button>
          )}

          <div className="mt-10 text-sm text-gray-500 flex items-center justify-center gap-2">
            <Sparkles className="text-yellow-500" size={16} />
            <span>
              After the meeting ends: AI auto-generates{" "}
              <strong>Transcript → MoM → Email delivery</strong>.
            </span>
          </div>
        </div>
      )}

      {/* ---------- ACTIVE MEETING ---------- */}
      {joined && (
        <div className="relative z-10 flex flex-col items-center gap-6 animate-fade-in mt-4">
          {/* Live Indicator */}
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-red-600 font-semibold text-sm tracking-wide">
              LIVE - Recording & AI Transcribing
            </span>
          </div>

          {/* Video Section */}
          <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-100">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted // muted for echo prevention, actual mic control via tracks
              className="rounded-xl shadow-md w-[420px] md:w-[540px] border border-gray-200"
            />
          </div>

          {/* Control Buttons */}
          <div className="flex gap-6 mt-2">
            <button
              onClick={() => setMicOn(!micOn)}
              className={`p-5 rounded-full transition-all duration-300 shadow-md ${
                micOn
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-red-100 text-red-700 hover:bg-red-200"
              }`}
              title={micOn ? "Mute Microphone" : "Unmute Microphone"}
            >
              {micOn ? <Mic size={22} /> : <MicOff size={22} />}
            </button>

            <button
              onClick={leaveMeeting}
              className="p-5 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg transition-all duration-300 active:scale-95"
              title="End Meeting"
            >
              <PhoneOff size={24} />
            </button>
          </div>

          <p className="text-gray-600 text-sm mt-4">
            🎙 AI is actively listening and transcribing your discussion in
            real-time...
            <br />
            <span className="text-indigo-600 font-medium">
              Transcript & Summary will be saved automatically.
            </span>
          </p>
        </div>
      )}

      {/* ---------- AI PROCESSING SCREEN ---------- */}
      {meetingEnded && (
        <div className="relative z-10 flex flex-col items-center text-center mt-10 animate-fade-in">
          <CheckCircle2 className="text-green-500" size={64} />
          <h2 className="text-2xl font-bold text-gray-800 mt-3">
            Processing Meeting Data...
          </h2>
          <p className="text-gray-600 mt-3 max-w-md leading-relaxed">
            Our AI is preparing your{" "}
            <strong>transcript</strong> and{" "}
            <strong>Minutes of Meeting</strong>. Once ready, both will be saved
            to your workspace and emailed automatically.
          </p>
          <Loader2 className="animate-spin text-indigo-600 mt-5" size={28} />
          <p className="text-sm text-gray-500 mt-2">
            This usually takes less than 1 minute.
          </p>
        </div>
      )}
    </div>
  );
};

export default MeetingRoom;
