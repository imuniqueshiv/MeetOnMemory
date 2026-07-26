import React from "react";
import { UploadCloud, FileAudio, X } from "lucide-react";

const Dropzone = ({
  file,
  setFile,
  isDragging,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileChange,
  fileInputRef,
  formatFileSize,
}) => {
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 text-center select-none min-h-[190px] ${
        isDragging
          ? "border-blue-500 bg-blue-50/60 shadow-inner scale-[0.99]"
          : file
            ? "border-emerald-200 bg-emerald-50/10 hover:bg-emerald-50/20"
            : "border-gray-200 dark:border-gray-600 bg-gray-50/30 dark:bg-gray-700/30 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/10 dark:hover:bg-blue-900/20"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {file ? (
        <div className="flex flex-col items-center animate-fade-in">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-3 shadow-sm">
            <FileAudio className="w-7 h-7" />
          </div>
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200 max-w-[240px] truncate mb-1">
            {file.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-3">
            {formatFileSize(file.size)} • {file.type || "Audio File"}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-semibold bg-red-50 dark:bg-red-900/30 hover:bg-red-100/85 dark:hover:bg-red-900/50 px-3 py-1.5 rounded-lg transition-colors duration-150"
          >
            <X className="w-3.5 h-3.5" />
            Remove File
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
            <UploadCloud className="w-7 h-7" />
          </div>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">
            Drag and drop your audio file here
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-3">
            or click to browse local files
          </p>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 bg-gray-100/80 dark:bg-gray-700/50 border border-gray-200/50 dark:border-gray-600 rounded-full px-3 py-1 font-semibold">
            WAV, MP3, M4A
          </span>
        </div>
      )}
    </div>
  );
};

export default Dropzone;
