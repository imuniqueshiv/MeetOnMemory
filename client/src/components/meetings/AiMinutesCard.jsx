import React, { useState } from "react";
import {
  FileText,
  Sparkles,
  Loader2,
  Download,
  File,
  Code,
  Image as ImageIcon,
  Printer,
  Edit3,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Copy,
  FileCode,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "react-toastify";

export default function AiMinutesCard({
  isSummarizing = false,
  summary = "",
  setSummary,
  handleGenerateSummary,
  onRegenerate,
  onSaveSection,
  showExportMenu = false,
  setShowExportMenu = () => {},
  isExporting = false,
  handleExport,
  canEdit = true,
  canGenerate = true,
  canExport = true,
  isError = false,
  errorMessage = "",
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(summary || "");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleStartEdit = () => {
    setEditContent(
      typeof summary === "string" ? summary : JSON.stringify(summary, null, 2),
    );
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(
      typeof summary === "string" ? summary : JSON.stringify(summary, null, 2),
    );
  };

  const handleSaveEdit = async () => {
    try {
      setIsSavingEdit(true);
      if (onSaveSection) {
        await onSaveSection(editContent);
      } else if (setSummary) {
        setSummary(editContent);
      }
      toast.success("Section updated successfully!");
      setIsEditing(false);
    } catch (err) {
      console.error("Save section error:", err);
      toast.error(err.message || "Failed to save section edits");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    const textToCopy =
      typeof summary === "string" ? summary : JSON.stringify(summary, null, 2);
    navigator.clipboard.writeText(textToCopy);
    toast.success("MoM copied to clipboard!");
  };

  const summaryText =
    typeof summary === "string" ? summary : JSON.stringify(summary, null, 2);

  return (
    <div className="flex flex-col h-[600px] w-full">
      {/* Generate / Action Banner */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-blue-100 dark:border-blue-900/50 p-6 shadow-xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all hover:shadow-2xl">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            AI Minutes of Meeting (MoM)
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            Extract action items, key decisions, and structured summaries
            automatically.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {summary ? (
            <button
              onClick={onRegenerate || handleGenerateSummary}
              disabled={isSummarizing || !canGenerate}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all w-full sm:w-auto ${
                isSummarizing || !canGenerate
                  ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none"
                  : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
              }`}
              title={
                !canGenerate
                  ? "You do not have permission to generate MoMs"
                  : "Regenerate MoM"
              }
            >
              {isSummarizing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleGenerateSummary}
              disabled={isSummarizing || !canGenerate}
              className={`px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all duration-200 whitespace-nowrap w-full sm:w-auto ${
                isSummarizing || !canGenerate
                  ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0"
              }`}
              title={
                !canGenerate
                  ? "You do not have permission to generate MoMs"
                  : "Generate MoM"
              }
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
          )}
        </div>
      </div>

      {/* Error Alert State */}
      {isError && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center justify-between gap-3 text-sm font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span>
              {errorMessage ||
                "Failed to compile Minutes of Meeting. Please try again."}
            </span>
          </div>
          {handleGenerateSummary && (
            <button
              onClick={handleGenerateSummary}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* MoM Display & Editor Container */}
      <div className="flex-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-lg flex flex-col transition-all hover:shadow-xl relative">
        <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            Structured Output
          </h3>

          {/* Action Toolbar */}
          {summaryText && (
            <div className="flex items-center gap-2">
              {/* Copy Action */}
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                title="Copy MoM text"
              >
                <Copy className="w-3.5 h-3.5 text-gray-500" />
                <span className="hidden sm:inline">Copy</span>
              </button>

              {/* Edit Section Action (RBAC gated) */}
              {canEdit && (
                <button
                  onClick={isEditing ? handleCancelEdit : handleStartEdit}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                  title="Edit structured section text"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{isEditing ? "Cancel" : "Edit Section"}</span>
                </button>
              )}

              {/* Print Action */}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                title="Print formatted Minutes of Meeting"
              >
                <Printer className="w-3.5 h-3.5 text-gray-500" />
                <span className="hidden sm:inline">Print</span>
              </button>

              {/* Export Dropdown */}
              {handleExport && canExport && (
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Export</span>
                  </button>

                  {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-50">
                      <button
                        onClick={() => {
                          setShowExportMenu(false);
                          handleExport("pdf");
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                      >
                        <File className="w-4 h-4 text-red-500" /> PDF Document
                      </button>
                      <button
                        onClick={() => {
                          setShowExportMenu(false);
                          handleExport("docx");
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                      >
                        <FileCode className="w-4 h-4 text-blue-500" /> DOCX Word
                      </button>
                      <button
                        onClick={() => {
                          setShowExportMenu(false);
                          handleExport("markdown");
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                      >
                        <Code className="w-4 h-4 text-indigo-500" /> Markdown
                      </button>
                      <button
                        onClick={() => {
                          setShowExportMenu(false);
                          handleExport("image");
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
                      >
                        <ImageIcon className="w-4 h-4 text-green-500" /> Image
                        PNG
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content Body / Editor */}
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
                Structuring action items, key decisions, and takeaways.
              </p>
            </div>
          ) : isEditing ? (
            <div className="flex flex-col h-full space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 w-full p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Edit structured MoM content..."
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={isSavingEdit}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          ) : summaryText ? (
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
              <ReactMarkdown>{summaryText}</ReactMarkdown>
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
                Click &quot;Generate MoM&quot; to create structured minutes from
                the transcript.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
