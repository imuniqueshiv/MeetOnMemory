import React from "react";
import { MessageSquare, Headphones, ArrowRight, FileText } from "lucide-react";

export default function TranscriptCard({ transcript, audioUrl }) {
  if (!transcript) return null;

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-lg flex flex-col h-[600px] transition-all hover:shadow-xl">
      <div className="bg-gray-50/80 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-500" />
          Raw Transcript
        </h3>
        <span className="text-xs font-semibold px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800">
          Source
        </span>
      </div>

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        {/* Simple Audio Player (if URL is available) */}
        {audioUrl && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-600">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
              <Headphones className="w-4 h-4 text-blue-500" />
              Original Audio
            </h4>
            <audio
              controls
              className="w-full rounded-md shadow-sm"
              src={audioUrl}
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-blue">
          {/* Display as continuous text, maybe split by speakers if the backend supports it later. For now, it's a block. */}
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
            {transcript}
          </p>
        </div>
      </div>
    </div>
  );
}
