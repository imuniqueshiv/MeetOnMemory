import React from "react";
import {
  Type,
  Calendar,
  AlertCircle,
  FileAudio,
  UploadCloud,
  Loader2,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import Dropzone from "./Dropzone.jsx";

export default function UploadMeetingForm({
  title,
  setTitle,
  meetingDate,
  setMeetingDate,
  file,
  setFile,
  isDragging,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileChange,
  fileInputRef,
  formatFileSize,
  isUploading,
  uploadProgress,
  handleUpload,
  resetUpload,
  setSummary,
}) {
  return (
    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-xl rounded-2xl border border-gray-100 dark:border-gray-700 p-6 md:p-8 mb-10 transition-all duration-300 hover:shadow-2xl fade-in-up stagger-1">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Column: Form Inputs */}
        <div className="flex flex-col justify-between space-y-5">
          <div>
            <label
              htmlFor="meeting-title"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5"
            >
              <Type className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              Optional Title
            </label>
            <div className="relative">
              <input
                id="meeting-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="AI will auto-generate if left blank"
                className="block w-full text-sm text-gray-700 dark:text-gray-200 bg-gray-50/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 rounded-xl py-3 px-4 transition-all duration-200 outline-none focus:ring-4 focus:ring-blue-500/10 placeholder-gray-400 dark:placeholder-gray-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="meeting-date"
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              Meeting Date{" "}
              <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                id="meeting-date"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="block w-full sm:w-56 text-sm text-gray-700 dark:text-gray-200 bg-gray-50/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 rounded-xl py-3 px-4 transition-all duration-200 outline-none focus:ring-4 focus:ring-blue-500/10 font-medium"
                required
              />
            </div>
          </div>

          <div className="pt-2 text-xs text-gray-400 dark:text-gray-500 leading-relaxed flex items-start gap-1.5">
            <AlertCircle className="w-4.5 h-4.5 text-blue-400 dark:text-blue-500 shrink-0 mt-0.5" />
            <span>
              Meeting date is required for compiling summaries. Accepted audio
              formats include <strong>WAV</strong>, <strong>MP3</strong>, and{" "}
              <strong>M4A</strong>.
            </span>
          </div>
        </div>

        {/* Right Column: Audio Drag & Drop Area */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <FileAudio className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            Choose Meeting Audio
          </label>

          <Dropzone
            file={file}
            setFile={setFile}
            isDragging={isDragging}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            handleFileChange={handleFileChange}
            fileInputRef={fileInputRef}
            formatFileSize={formatFileSize}
          />
        </div>
      </div>

      {/* Footer Actions inside Card */}
      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-start order-2 sm:order-1">
          <button
            onClick={() => handleUpload(title, setTitle)}
            disabled={isUploading || !file}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
              isUploading || !file
                ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none border border-gray-200 dark:border-gray-600"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/10 hover:shadow-blue-500/25 hover:-translate-y-0.5 active:translate-y-0"
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Uploading ({uploadProgress}%)</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Upload & Transcribe</span>
              </>
            )}
          </button>

          <button
            onClick={() => resetUpload(setSummary, setTitle)}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Reset
          </button>
        </div>

        <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto justify-center sm:justify-start">
          {file ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ready to transcribe
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500 text-xs font-medium">
              No file selected
            </span>
          )}
        </div>
      </div>

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="mt-6 w-full animate-pulse">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2 font-bold">
            <span>Sending audio package to server...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
