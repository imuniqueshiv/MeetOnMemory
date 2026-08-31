import React from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useMediasoup } from "../hooks/useMediasoup";
import VideoGrid from "../components/meeting-room/VideoGrid";
import MediaControls from "../components/meeting-room/MediaControls";

export default function MediasoupMeetingRoom() {
  const { roomId } = useParams();
  const { userId } = useAuth();

  const {
    isConnected,
    localStream,
    remoteStreams,
    isMuted,
    isVideoHidden,
    isScreenSharing,
    error,
    startCamera,
    toggleMic,
    toggleVideo,
    toggleScreenShare,
  } = useMediasoup(roomId, userId);

  return (
    <div className="flex flex-col w-full h-screen bg-black text-white">
      <div className="flex-1 overflow-hidden relative">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 px-4 py-2 rounded-md z-10 shadow-lg">
            {error}
          </div>
        )}

        <VideoGrid
          localStream={localStream}
          remoteStreams={remoteStreams}
          isMuted={isMuted}
          isVideoHidden={isVideoHidden}
        />
      </div>

      <div className="h-20 shrink-0">
        <MediaControls
          isConnected={isConnected}
          isMuted={isMuted}
          isVideoHidden={isVideoHidden}
          isScreenSharing={isScreenSharing}
          toggleMic={toggleMic}
          toggleVideo={toggleVideo}
          toggleScreenShare={toggleScreenShare}
          startCamera={startCamera}
        />
      </div>
    </div>
  );
}
