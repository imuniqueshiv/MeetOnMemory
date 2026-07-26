import React from "react";
import {
  FileText,
  Sparkles,
  Loader2,
  Download,
  File,
  Code,
  Image as ImageIcon,
} from "lucide-react";
import MarkdownRenderer from "../MarkdownRenderer";

export default function AiMinutesCard({
  isSummarizing,
  summary,
  handleGenerateSummary,
  showExportMenu,
  setShowExportMenu,
  isExporting,
  handleExport,
}) {
  return (
    <div className="flex flex-col h-[600px]">
      {/* Generate Action Button */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-blue-100 dark:border-blue-900/50 p-6 shadow-xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all hover:shadow-2xl">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            AI Minutes of Meeting
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            Extract action items, decisions, and summaries automatically.
          </p>
        </div>
        <button
          onClick={handleGenerateSummary}
          disabled={isSummarizing}
          className={`px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap w-full sm:w-auto ${
            isSummarizing
              ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0"
          }`}
        >
          {isSummarizing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>Generate MoM</>
          )}
        </button>
      </div>

      {/* MoM Display Area */}
      <div className="flex-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-lg flex flex-col transition-all hover:shadow-xl relative">
        <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            Structured Output
          </h3>

          {/* Export Dropdown */}
          {summary && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-50">
                  <button
                    onClick={() => handleExport("pdf")}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                  >
                    <File className="w-4 h-4 text-red-500" /> PDF Document
                  </button>
                  <button
                    onClick={() => handleExport("markdown")}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                  >
                    <Code className="w-4 h-4 text-blue-500" /> Markdown
                  </button>
                  <button
                    onClick={() => handleExport("image")}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4 text-green-500" /> Image PNG
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-gray-50/30 dark:bg-gray-900/30">
          {isSummarizing ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-4 animate-pulse">
              <div className="relative">
                <Sparkles className="w-12 h-12 text-blue-400 dark:text-blue-500 absolute -top-2 -right-2 animate-ping opacity-75" />
                <Sparkles className="w-12 h-12 text-indigo-500 dark:text-indigo-400" />
              </div>
              <p className="font-semibold text-lg text-gray-600 dark:text-gray-300">
                AI is analyzing your meeting...
              </p>
              <p className="text-sm max-w-xs text-center">
                This might take a minute depending on the length of the audio.
              </p>
            </div>
          ) : summary ? (
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
              <MarkdownRenderer content={summary} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3 opacity-60">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-2 border border-gray-200 dark:border-gray-700">
                <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="font-medium text-gray-500 dark:text-gray-400">
                No summary generated yet.
              </p>
              <p className="text-sm text-center max-w-xs">
                Click "Generate MoM" to create structured minutes from the
                transcript.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
