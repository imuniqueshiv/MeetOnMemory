import React, { useState, useEffect, useRef } from "react";
import { Mic, Square, Loader2, AlertCircle, Play } from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";
import { meetingApi } from "../../services";

const MeetingRecorder = ({
  meetingId,
  onTranscriptUpdate,
  onMeetingCreated,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const durationIntervalRef = useRef(null);

  // Initialize recording
  const startRecording = async () => {
    try {
      setError(null);
      let activeMeetingId = meetingId;

      // If no meeting ID exists, create a quick live meeting first
      if (!activeMeetingId) {
        try {
          const res = await meetingApi.scheduleMeeting({
            title: "Live Recording " + new Date().toLocaleTimeString(),
            date: new Date().toISOString(),
          });
          if (res.data && res.data.meeting) {
            activeMeetingId = res.data.meeting._id;
            if (onMeetingCreated) onMeetingCreated(activeMeetingId);
          } else {
            throw new Error("Failed to create meeting");
          }
        } catch (err) {
          console.error("Error creating meeting:", err);
          toast.error("Failed to create meeting for recording.");
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && activeMeetingId) {
          // Send chunk to server
          const formData = new FormData();
          formData.append("audio", e.data, "chunk.webm");
          try {
            const res = await axios.post(
              `/api/meetings/${activeMeetingId}/transcript/chunk`,
              formData,
              {
                headers: { "Content-Type": "multipart/form-data" },
                withCredentials: true,
              },
            );
            if (res.data.success) {
              if (onTranscriptUpdate) {
                onTranscriptUpdate(res.data.text, res.data.fullText);
              }
            }
          } catch (err) {
            console.error("Error sending chunk:", err);
          }
        }
      };

      mediaRecorder.start(5000); // 5 seconds chunks
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Start duration timer
      setDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Setup Visualizer
      setupVisualizer(stream);
    } catch (err) {
      console.error("Microphone error:", err);
      setError("Microphone access denied or unavailable.");
      toast.error("Failed to access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current.getTracks().forEach((track) => track.stop());
      setIsRecording(false);

      clearInterval(durationIntervalRef.current);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      // Draw flat line
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.strokeStyle = "#9CA3AF"; // gray-400
        ctx.stroke();
      }
    }
  };

  const setupVisualizer = (stream) => {
    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    source.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasCtx = canvas.getContext("2d");

    const draw = () => {
      if (!isRecording) return;
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = "rgb(249, 250, 251)"; // gray-50
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        canvasCtx.fillStyle = `rgb(59, 130, 246)`; // blue-500
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (isRecording) {
        stopRecording();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm w-full h-full">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Mic
              className={`w-5 h-5 ${isRecording ? "text-red-500 animate-pulse" : "text-gray-400"}`}
            />
            Live Recorder
          </h3>
          <div
            className={`text-sm font-medium font-mono ${isRecording ? "text-red-500" : "text-gray-500"}`}
          >
            {formatDuration(duration)}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="mb-6 rounded-xl overflow-hidden bg-gray-50 border border-gray-200">
          <canvas
            ref={canvasRef}
            width={400}
            height={80}
            className="w-full h-[80px]"
          />
        </div>

        <div className="flex justify-center">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition-transform active:scale-95 bg-red-500 hover:bg-red-600 text-white shadow-red-500/30`}
            >
              <Play className="w-5 h-5 fill-white" />
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-bold shadow-lg transition-transform active:scale-95"
            >
              <Square className="w-5 h-5 fill-white" />
              Stop Recording
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingRecorder;
