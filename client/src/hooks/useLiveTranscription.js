import { useState } from "react";
import { toast } from "react-toastify";

export default function useLiveTranscription(roomId, socketRef, streamRef) {
  const [showCaptions, setShowCaptions] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [captions, setCaptions] = useState([]);
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(false);
  const [audioContext, setAudioContext] = useState(null);
  const [audioProcessor, setAudioProcessor] = useState(null);

  const startTranscription = async () => {
    try {
      if (socketRef.current) {
        socketRef.current.emit("start-transcription", { roomId });
      }
      setupAudioProcessing();
    } catch (error) {
      console.error("Failed to start transcription:", error);
      toast.error("Failed to start transcription");
    }
  };

  const stopTranscription = async () => {
    try {
      if (socketRef.current) {
        socketRef.current.emit("stop-transcription", { roomId });
      }
      if (audioProcessor) {
        audioProcessor.disconnect();
        setAudioProcessor(null);
      }
      if (audioContext) {
        await audioContext.close();
        setAudioContext(null);
      }
    } catch (error) {
      console.error("Failed to stop transcription:", error);
      toast.error("Failed to stop transcription");
    }
  };

  const setupAudioProcessing = async () => {
    try {
      if (!streamRef.current) return;
      const context = new (window.AudioContext || window.webkitAudioContext)();
      setAudioContext(context);

      await context.audioWorklet.addModule("/audio-processor.js");

      const source = context.createMediaStreamSource(streamRef.current);
      const workletNode = new AudioWorkletNode(context, "audio-processor");

      workletNode.port.onmessage = (event) => {
        if (socketRef.current) {
          socketRef.current.emit("audio-data", {
            roomId,
            audioData: event.data,
          });
        }
      };

      source.connect(workletNode);
      workletNode.connect(context.destination);
      setAudioProcessor(workletNode);
    } catch (error) {
      console.error("Error setting up audio processing:", error);
    }
  };

  const toggleTranscription = () => {
    if (transcriptionEnabled) {
      stopTranscription();
    } else {
      startTranscription();
    }
  };

  return {
    showCaptions,
    setShowCaptions,
    showTranscript,
    setShowTranscript,
    captions,
    setCaptions,
    transcriptSegments,
    setTranscriptSegments,
    transcriptionEnabled,
    setTranscriptionEnabled,
    toggleTranscription,
  };
}
