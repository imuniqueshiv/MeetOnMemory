import React from "react";
import { Captions } from "lucide-react";

export default function LiveCaptions({ showCaptions, captions }) {
  if (!showCaptions || captions.length === 0) return null;

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 px-6 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Captions size={16} className="text-indigo-400" />
        <span className="text-gray-400 text-xs font-medium">Live Captions</span>
      </div>
      <div className="space-y-1 max-h-24 overflow-y-auto">
        {captions.map((caption, index) => (
          <div
            key={index}
            className={`text-sm ${
              caption.isFinal ? "text-white" : "text-gray-400 italic"
            }`}
          >
            {caption.speaker && (
              <span className="text-indigo-400 font-medium mr-2">
                {caption.speaker}:
              </span>
            )}
            {caption.text}
          </div>
        ))}
      </div>
    </div>
  );
}
