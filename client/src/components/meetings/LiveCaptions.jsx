import React from "react";
import { Captions, Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";

export default function LiveCaptions({
  showCaptions,
  captions = [],
  saveStatus = "idle",
  onRetry,
  errorMessage,
}) {
  if (!showCaptions || captions.length === 0) return null;

  return (
    <div
      data-testid="live-captions-container"
      className="bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 px-6 py-3"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Captions size={16} className="text-indigo-400" />
          <span className="text-gray-400 text-xs font-medium">
            Live Captions
          </span>
        </div>

        {/* Persistence Save Status */}
        {saveStatus === "saving" && (
          <div
            data-testid="caption-save-saving"
            className="flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20"
          >
            <Loader2 size={12} className="animate-spin text-indigo-400" />
            <span className="text-[11px]">Saving...</span>
          </div>
        )}

        {saveStatus === "saved" && (
          <div
            data-testid="caption-save-saved"
            className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"
          >
            <Check size={12} className="text-emerald-400" />
            <span className="text-[11px]">Saved</span>
          </div>
        )}

        {saveStatus === "error" && (
          <div
            data-testid="caption-save-error"
            className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20"
          >
            <AlertCircle size={12} className="text-rose-400 shrink-0" />
            <span className="text-[11px] truncate max-w-[140px] sm:max-w-[200px]">
              {errorMessage || "Save failed"}
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                aria-label="Retry saving captions"
                className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 underline cursor-pointer focus:outline-none"
              >
                <RefreshCw size={10} />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}
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
