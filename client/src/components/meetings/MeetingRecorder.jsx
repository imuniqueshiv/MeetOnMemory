import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  Square,
  AlertCircle,
  Play,
  Pause,
  Save,
  RotateCcw,
  Volume2,
  FileText,
  Trash2,
} from "lucide-react";
import apiClient from "../../services/apiClient";
import { toast } from "react-toastify";
import { meetingApi } from "../../services";

const LOCAL_STORAGE_KEY = "meetonmemory_meeting_recorder_draft";

const MeetingRecorder = ({
  meetingId,
  onTranscriptUpdate,
  onMeetingCreated,
  onRecordingFinalized,
  title,
  date,
  tags,
}) => {
  const [recordingState, setRecordingState] = useState("idle"); // 'idle' | 'recording' | 'paused' | 'stopped'
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptContainerRef = useRef(null);
  const activeMeetingIdRef = useRef(meetingId);

  activeMeetingIdRef.current = meetingId;

  // Save local draft continuously
  const saveDraftLocally = useCallback(
    (currentTranscript, currentDuration, currentState) => {
      try {
        const draft = {
          meetingId: activeMeetingIdRef.current || null,
          title: title || "Live Recording Draft",
          date: date || new Date().toISOString(),
          tags: tags || [],
          transcript: currentTranscript,
          duration: currentDuration,
          state: currentState,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(draft));
      } catch (err) {
        console.error("Failed to save recording draft locally:", err);
      }
    },
    [title, date, tags],
  );

  // Check for saved local draft on mount
  useEffect(() => {
    try {
      const savedDraftStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedDraftStr) {
        const savedDraft = JSON.parse(savedDraftStr);
        if (savedDraft && (savedDraft.transcript || savedDraft.duration > 0)) {
          setHasDraft(true);
        }
      }
    } catch (err) {
      console.warn("Failed to check saved draft:", err);
    }
  }, []);

  // Restore local draft
  const restoreDraft = () => {
    try {
      const savedDraftStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedDraftStr) {
        const savedDraft = JSON.parse(savedDraftStr);
        if (savedDraft.meetingId && onMeetingCreated) {
          onMeetingCreated(savedDraft.meetingId);
        }
        if (savedDraft.transcript) {
          setLiveTranscript(savedDraft.transcript);
          if (onTranscriptUpdate) {
            onTranscriptUpdate(savedDraft.transcript, savedDraft.transcript);
          }
        }
        if (savedDraft.duration) {
          setDuration(savedDraft.duration);
        }
        setRecordingState("stopped");
        setHasDraft(false);
        toast.success("Restored unsaved recording draft!");
      }
    } catch (err) {
      console.error("Restore draft error:", err);
      toast.error("Failed to restore draft.");
    }
  };

  // Discard local draft
  const discardDraft = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setHasDraft(false);
    toast.info("Draft discarded.");
  };

  // Auto scroll transcript box
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop =
        transcriptContainerRef.current.scrollHeight;
    }
  }, [liveTranscript]);

  // Setup Web Speech API for live browser speech-to-text
  const setupSpeechRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcriptChunk + " ";
          }
        }

        if (finalChunk) {
          setLiveTranscript((prev) => {
            const nextTranscript = prev ? `${prev}\n${finalChunk}` : finalChunk;
            if (onTranscriptUpdate) {
              onTranscriptUpdate(finalChunk, nextTranscript);
            }
            saveDraftLocally(nextTranscript, duration, "recording");
            return nextTranscript;
          });
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition warning:", event.error);
      };

      recognition.onend = () => {
        if (recordingState === "recording" && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (err) {
            console.warn("Recognition restart error:", err);
          }
        }
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("Speech recognition init error:", err);
    }
  };

  // Start Recording
  const startRecording = async () => {
    try {
      setError(null);
      let activeMeetingId = meetingId;

      if (!activeMeetingId) {
        try {
          const res = await meetingApi.scheduleMeeting({
            title: title || "Live Recording " + new Date().toLocaleTimeString(),
            date: date || new Date().toISOString(),
            tags: tags || [],
          });
          if (res.data && res.data.meeting) {
            activeMeetingId = res.data.meeting._id;
            activeMeetingIdRef.current = activeMeetingId;
            if (onMeetingCreated) onMeetingCreated(activeMeetingId);
          } else {
            throw new Error("Failed to create meeting session");
          }
        } catch (err) {
          console.error("Error creating meeting:", err);
          setError("Failed to initialize meeting session.");
          toast.error("Failed to create meeting session for recording.");
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && activeMeetingIdRef.current) {
          const formData = new FormData();
          formData.append("audio", e.data, "chunk.webm");
          try {
            const res = await apiClient.post(
              `/api/meetings/${activeMeetingIdRef.current}/transcript/chunk`,
              formData,
              {
                headers: { "Content-Type": "multipart/form-data" },
                withCredentials: true,
              },
            );
            if (res.data.success && res.data.fullText) {
              setLiveTranscript(res.data.fullText);
              if (onTranscriptUpdate) {
                onTranscriptUpdate(res.data.text, res.data.fullText);
              }
              saveDraftLocally(res.data.fullText, duration, "recording");
            }
          } catch (err) {
            console.error("Error sending audio chunk:", err);
          }
        }
      };

      mediaRecorder.start(5000);
      mediaRecorderRef.current = mediaRecorder;
      setRecordingState("recording");

      if (!durationIntervalRef.current) {
        durationIntervalRef.current = setInterval(() => {
          setDuration((prev) => {
            const nextDur = prev + 1;
            saveDraftLocally(liveTranscript, nextDur, "recording");
            return nextDur;
          });
        }, 1000);
      }

      setupSpeechRecognition();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.warn("Start recognition error:", err);
        }
      }

      setupVisualizer(stream);
      toast.success("Recording started");
    } catch (err) {
      console.error("Microphone access error:", err);
      setError(
        "Microphone access denied or unavailable. Please check permissions.",
      );
      toast.error("Failed to access microphone.");
    }
  };

  // Pause Recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.pause();
      setRecordingState("paused");
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.warn("Pause recognition error:", err);
        }
      }
      toast.info("Recording paused");
    }
  };

  // Resume Recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === "paused") {
      mediaRecorderRef.current.resume();
      setRecordingState("recording");
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.warn("Resume recognition error:", err);
        }
      }
      toast.info("Recording resumed");
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState !== "stopped") {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn("Stop recorder error:", err);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.warn("Stop recognition error:", err);
        }
      }

      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (err) {
          console.warn("AudioContext close error:", err);
        }
      }

      setRecordingState("stopped");
      setAudioLevel(0);
      saveDraftLocally(liveTranscript, duration, "stopped");
      toast.info("Recording stopped. Ready to finalize.");
    }
  };

  // Save / Finalize Recording
  const handleSaveRecording = () => {
    stopRecording();
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    if (onRecordingFinalized) {
      onRecordingFinalized({
        meetingId: activeMeetingIdRef.current,
        transcript: liveTranscript,
        duration,
      });
    }
  };

  // Cancel Recording
  const handleCancelRecording = () => {
    if (
      window.confirm(
        "Are you sure you want to cancel and discard this recording?",
      )
    ) {
      stopRecording();
      setLiveTranscript("");
      setDuration(0);
      setRecordingState("idle");
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      toast.info("Recording cancelled.");
    }
  };

  // Visualizer setup
  const setupVisualizer = (stream) => {
    try {
      const audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      source.connect(analyser);
      analyser.fftSize = 128;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const canvasCtx = canvas.getContext("2d");

      const draw = () => {
        if (recordingState === "stopped") return;
        animationFrameRef.current = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avgLevel = Math.min(
          100,
          Math.round((sum / bufferLength / 128) * 100),
        );
        setAudioLevel(avgLevel);

        canvasCtx.fillStyle = "rgb(15, 23, 42)";
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = (dataArray[i] / 255) * canvas.height;
          canvasCtx.fillStyle =
            recordingState === "paused"
              ? "rgb(234, 179, 8)"
              : "rgb(239, 68, 68)";
          canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      };

      draw();
    } catch (err) {
      console.warn("Visualizer audio context error:", err);
    }
  };

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current)
        clearInterval(durationIntervalRef.current);
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col items-center justify-between p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl w-full h-full min-h-[460px]">
      <div className="w-full">
        {/* Header & Status */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Mic
              className={`w-5 h-5 ${
                recordingState === "recording"
                  ? "text-red-500 animate-pulse"
                  : recordingState === "paused"
                    ? "text-amber-500"
                    : "text-gray-400"
              }`}
            />
            Live Meeting Recorder
          </h3>

          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                recordingState === "recording"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  : recordingState === "paused"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    : recordingState === "stopped"
                      ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              }`}
            >
              {recordingState}
            </span>

            <div className="text-base font-bold font-mono text-gray-900 dark:text-gray-100">
              {formatDuration(duration)}
            </div>
          </div>
        </div>

        {/* Draft Recovery Banner */}
        {hasDraft && recordingState === "idle" && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between text-xs">
            <span className="text-blue-800 dark:text-blue-200 font-medium">
              An unsaved recording draft was restored from your previous
              session.
            </span>
            <div className="flex gap-2">
              <button
                onClick={restoreDraft}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
              >
                Restore
              </button>
              <button
                onClick={discardDraft}
                className="px-2 py-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl mb-4 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Audio Visualizer & Level Indicator */}
        <div className="relative mb-4 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shadow-inner">
          <canvas
            ref={canvasRef}
            width={400}
            height={70}
            className="w-full h-[70px]"
          />
          {recordingState === "recording" && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded text-[10px] text-slate-300 font-mono">
              <Volume2 className="w-3 h-3 text-red-400" />
              <span>{audioLevel}%</span>
            </div>
          )}
        </div>

        {/* Real-time Streaming Transcript Box */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> Live Speech Stream
            </span>
            <span>
              {liveTranscript
                ? `${liveTranscript.length} chars`
                : "Listening..."}
            </span>
          </div>

          <div
            ref={transcriptContainerRef}
            className="w-full h-36 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-y-auto font-mono text-xs text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap shadow-inner"
          >
            {liveTranscript ? (
              liveTranscript
            ) : (
              <span className="text-gray-400 italic">
                {recordingState === "recording"
                  ? "Listening and transcribing speech live..."
                  : "Start recording to stream live transcript..."}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="w-full pt-2 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-center gap-3">
        {recordingState === "idle" && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold shadow-lg shadow-red-600/30 transition-transform active:scale-95 text-sm"
          >
            <Play className="w-4 h-4 fill-white" />
            Start Recording
          </button>
        )}

        {recordingState === "recording" && (
          <>
            <button
              onClick={pauseRecording}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-bold shadow-md transition-transform active:scale-95 text-sm"
            >
              <Pause className="w-4 h-4 fill-white" />
              Pause
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-full font-bold shadow-md transition-transform active:scale-95 text-sm"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop
            </button>
            <button
              onClick={handleCancelRecording}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-600 dark:text-gray-300 rounded-full font-semibold text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Cancel
            </button>
          </>
        )}

        {recordingState === "paused" && (
          <>
            <button
              onClick={resumeRecording}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold shadow-md transition-transform active:scale-95 text-sm"
            >
              <Play className="w-4 h-4 fill-white" />
              Resume
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-full font-bold shadow-md transition-transform active:scale-95 text-sm"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop
            </button>
            <button
              onClick={handleCancelRecording}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-600 dark:text-gray-300 rounded-full font-semibold text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Cancel
            </button>
          </>
        )}

        {recordingState === "stopped" && (
          <>
            <button
              onClick={handleSaveRecording}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-bold shadow-lg shadow-green-600/30 transition-transform active:scale-95 text-sm"
            >
              <Save className="w-4 h-4" />
              Save & Process
            </button>
            <button
              onClick={startRecording}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-full font-semibold text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Re-record
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MeetingRecorder;
