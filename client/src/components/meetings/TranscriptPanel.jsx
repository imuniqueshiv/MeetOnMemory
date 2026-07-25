import React from "react";
import { FileText, X, Captions } from "lucide-react";

export default function TranscriptPanel({
  showTranscript,
  setShowTranscript,
  transcriptSegments,
}) {
  if (!showTranscript) return null;

  const formatTimestamp = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full md:w-[420px] lg:w-[480px] shrink-0 p-4 bg-gray-950 border-l border-gray-800 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <FileText size={18} />
          Live Transcript
        </h3>
        <button
          onClick={() => setShowTranscript(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3">
        {transcriptSegments.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            <Captions size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No transcript yet</p>
            <p className="text-xs mt-1">
              Enable captions to start transcription
            </p>
          </div>
        ) : (
          transcriptSegments.map((segment, index) => (
            <div
              key={index}
              className="bg-gray-800 rounded-lg p-3 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-indigo-400 text-sm font-medium">
                  {segment.speaker || "Speaker"}
                </span>
                <span className="text-gray-500 text-xs">
                  {formatTimestamp(segment.startTime)}
                </span>
              </div>
              <p className="text-gray-300 text-sm">{segment.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
