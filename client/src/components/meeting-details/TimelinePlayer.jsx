import React from "react";

const TimelinePlayer = ({
  meeting,
  playerRef,
  isPlaying,
  togglePlayPause,
  handleTimeUpdate,
  handleDurationChange,
  setIsPlaying,
}) => {
  // If there's an audioFilePath or fileUrl, use it; else, placeholder
  const mediaPath = meeting?.audioFilePath || meeting?.fileUrl || null;
  const audioUrl = mediaPath
    ? mediaPath.startsWith("http")
      ? mediaPath
      : `/api/media/${mediaPath}`
    : null;

  if (!audioUrl) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center text-gray-500 text-sm">
        No media available for this meeting to play.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <audio
        ref={playerRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="w-full hidden"
      />
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={togglePlayPause}
          className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg
              className="w-6 h-6 pl-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {isPlaying ? "Playing" : "Paused"}
        </div>
      </div>
    </div>
  );
};

export default TimelinePlayer;
