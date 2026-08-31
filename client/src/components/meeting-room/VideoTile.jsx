import React, { useEffect, useRef } from "react";

export default function VideoTile({
  stream,
  isLocal,
  name,
  isMuted,
  isVideoHidden,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center w-full h-full min-h-[200px] border border-gray-700">
      {isVideoHidden ? (
        <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center text-white text-3xl font-bold">
          {name ? name.charAt(0).toUpperCase() : "?"}
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      )}

      <div className="absolute bottom-2 left-2 bg-black/60 px-3 py-1 rounded-md text-white text-sm flex items-center gap-2">
        <span>{name || (isLocal ? "You" : "Participant")}</span>
        {isMuted && (
          <svg
            className="w-4 h-4 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
