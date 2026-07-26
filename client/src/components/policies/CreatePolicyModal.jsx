import React, { useRef, useState } from "react";
import { Upload, FilePlus, GitBranch, Loader2 } from "lucide-react";
import { ProgressBar } from "./PolicyUtils";

const DropZone = ({ onFile, disabled, selectedFile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload policy file"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) =>
        e.key === "Enter" && !disabled && inputRef.current?.click()
      }
      className={`
        relative flex flex-col items-center justify-center gap-3 px-6 py-10 rounded-xl border-2 border-dashed cursor-pointer transition-all
        ${disabled ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50" : ""}
        ${isDragging ? "border-indigo-400 bg-indigo-50 scale-[1.01]" : !disabled ? "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40 bg-gray-50" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <div
        className={`p-3 rounded-full transition ${isDragging ? "bg-indigo-100" : "bg-white shadow-sm"}`}
      >
        <Upload
          className={`w-6 h-6 ${isDragging ? "text-indigo-600" : "text-gray-400"}`}
        />
      </div>
      {selectedFile ? (
        <div className="text-center">
          <p className="font-medium text-gray-800 text-sm">
            {selectedFile.name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {(selectedFile.size / 1024).toFixed(0)} KB · Click to change
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="font-medium text-gray-700 text-sm">
            {isDragging ? "Drop to upload" : "Drag & drop or click to select"}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            PDF, DOCX, or TXT · Max 20 MB
          </p>
        </div>
      )}
    </div>
  );
};

// Note: Named CreatePolicyModal to match requested requirements,
// though it renders in-page as a card for admin use.
const CreatePolicyModal = React.forwardRef(
  (
    {
      onFileSelect,
      file,
      isUploading,
      uploadStage,
      uploadProgress,
      showUpdatePrompt,
      existingPolicy,
      commitMsg,
      setCommitMsg,
      handleUpload,
      setShowUpdatePrompt,
      setExistingPolicy,
      setFile,
      setUploadStage,
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className="bg-white dark:bg-gray-800 shadow-sm rounded-2xl mb-8 border border-gray-100 dark:border-gray-700 overflow-hidden"
      >
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <FilePlus className="w-5 h-5 text-indigo-500" />
            Upload Policy Document
          </h2>

          <DropZone
            onFile={onFileSelect}
            disabled={isUploading}
            selectedFile={file}
          />

          <ProgressBar progress={uploadProgress} stage={uploadStage} />
        </div>

        {showUpdatePrompt && existingPolicy && (
          <div className="mx-6 mt-4 mb-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-1 text-sm">
              <GitBranch className="w-4 h-4" />
              This file already exists — currently at v
              {existingPolicy.version || "1.0"}
            </h3>
            <p className="text-xs text-amber-700 mb-3">
              Upload as a <strong>new version</strong> with a commit message, or
              rename your file to upload as a separate policy.
            </p>
            <input
              type="text"
              placeholder="Describe the changes (e.g., Updated Section 2: Staff Policy)"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              disabled={isUploading}
              className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleUpload(true)}
                disabled={isUploading}
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GitBranch className="w-4 h-4" />
                )}
                {isUploading ? "Processing…" : "Commit & Upload New Version"}
              </button>
              <button
                onClick={() => {
                  setShowUpdatePrompt(false);
                  setExistingPolicy(null);
                  setFile(null);
                  setUploadStage("idle");
                }}
                disabled={isUploading}
                className="border border-gray-300 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!showUpdatePrompt && (
          <div className="px-6 pb-6 pt-4 flex gap-2">
            <button
              onClick={() => handleUpload(false)}
              disabled={isUploading || !file}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />{" "}
                  {uploadStage === "processing"
                    ? "AI Processing…"
                    : "Uploading…"}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Upload
                </>
              )}
            </button>
            {file && !isUploading && (
              <button
                onClick={() => {
                  setFile(null);
                  setUploadStage("idle");
                  setShowUpdatePrompt(false);
                }}
                className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
);

export default CreatePolicyModal;
