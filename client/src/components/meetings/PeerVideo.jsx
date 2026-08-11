import React, { useEffect, useRef } from "react";
import { MEETING_VIDEO_TILE_CLASS } from "../../utils/meetingVideoGrid.js";

export default function PeerVideo({ peer, userInfo }) {
  const ref = useRef();
  const displayName = userInfo?.name || "Participant";
  const profilePic = userInfo?.profilePic || "";
  const initial = (displayName || "P").charAt(0).toUpperCase();

  useEffect(() => {
    peer.on("stream", (stream) => {
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    });
  }, [peer]);

  return (
    <div className={MEETING_VIDEO_TILE_CLASS}>
      <video
        playsInline
        autoPlay
        ref={ref}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-black/60 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg backdrop-blur-sm text-white text-xs sm:text-sm flex items-center gap-2 max-w-[calc(100%-1rem)] truncate">
        {profilePic ? (
          <img
            src={profilePic}
            alt=""
            className="w-5 h-5 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-semibold shrink-0">
            {initial}
          </div>
        )}
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
        <span className="truncate">{displayName}</span>
      </div>
    </div>
  );
}
