import React from "react";
import VideoTile from "./VideoTile";

export default function VideoGrid({
  localStream,
  remoteStreams,
  isMuted,
  isVideoHidden,
}) {
  const totalStreams = (localStream ? 1 : 0) + remoteStreams.length;

  let gridCols = "grid-cols-1";
  if (totalStreams >= 2 && totalStreams <= 4) gridCols = "grid-cols-2";
  else if (totalStreams >= 5 && totalStreams <= 9) gridCols = "grid-cols-3";
  else if (totalStreams > 9) gridCols = "grid-cols-4";

  return (
    <div className={`grid gap-4 w-full h-full p-4 ${gridCols} auto-rows-fr`}>
      {localStream && (
        <VideoTile
          stream={localStream}
          isLocal={true}
          name="You"
          isMuted={isMuted}
          isVideoHidden={isVideoHidden}
        />
      )}

      {remoteStreams.map((peer) => (
        <VideoTile
          key={peer.socketId}
          stream={peer.stream}
          isLocal={false}
          name={`Peer ${peer.socketId.substring(0, 4)}`} // Replace with actual user info
          isMuted={false} // Would need to sync status via signaling
          isVideoHidden={false} // Would need to sync status via signaling
        />
      ))}
    </div>
  );
}
