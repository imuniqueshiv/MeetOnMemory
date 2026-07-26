import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { Loader2, Mic, AlertCircle } from "lucide-react";

const LiveTranscriptPanel = ({ meetingId }) => {
  const [segments, setSegments] = useState([]);
  const [status, setStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    if (!meetingId) return;

    // Initialize socket connection
    socketRef.current = io("/", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to transcript socket");
      setStatus("connected");
      setError(null);
      
      // Join transcript room
      socketRef.current.emit("join-transcript-room", { meetingId });
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      setStatus("error");
      setError("Failed to connect to transcript service");
      toast.error("Failed to connect to transcript service");
    });

    socketRef.current.on("transcript-status", (data) => {
      console.log("Transcript status:", data);
      if (data.status === "recording") {
        setStatus("recording");
      } else if (data.status === "processing") {
        setStatus("processing");
      } else if (data.status === "completed") {
        setStatus("completed");
        setSegments(data.segments || []);
      } else if (data.status === "failed") {
        setStatus("error");
        setError("Transcription failed");
        toast.error("Transcription failed");
      }
    });

    socketRef.current.on("transcript-segment", (segment) => {
      console.log("New transcript segment:", segment);
      setSegments((prev) => [...prev, segment]);
      // Auto-scroll to bottom
      setTimeout(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });

    socketRef.current.on("transcript-final", (transcript) => {
      console.log("Final transcript received:", transcript);
      setStatus("completed");
      setSegments(transcript.segments || []);
      toast.success("Transcription completed!");
    });

    socketRef.current.on("transcript-error", (data) => {
      console.error("Transcript error:", data);
      setError(data.message || "Transcript error occurred");
      toast.error(data.message || "Transcript error occurred");
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave-transcript-room", { meetingId });
        socketRef.current.disconnect();
      }
    };
  }, [meetingId]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (status === "disconnected") {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Connecting to transcript service...</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>{error || "Transcript service error"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Live Transcript
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              status === "recording"
                ? "bg-red-100 text-red-700"
                : status === "processing"
                ? "bg-yellow-100 text-yellow-700"
                : status === "completed"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </div>

      {status === "recording" && segments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Mic className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Waiting for audio...</p>
        </div>
      ) : status === "processing" ? (
        <div className="text-center py-12 text-gray-500">
          <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin" />
          <p>Processing transcription...</p>
        </div>
      ) : segments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No transcript available yet</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {segments.map((segment, index) => (
            <div
              key={index}
              className="p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-600">
                  {segment.speaker || "Unknown"}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTime(segment.startTime)}
                </span>
              </div>
              <p className="text-sm text-gray-700">{segment.text}</p>
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}
    </div>
  );
};

export default LiveTranscriptPanel;
