import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Loader2, CheckCircle2 } from "lucide-react";
import CollaborativeEditor from "../components/meetings/CollaborativeEditor.jsx";
import PeerVideo from "../components/meetings/PeerVideo.jsx";
import MeetingHeader from "../components/meetings/MeetingHeader.jsx";
import MeetingControlBar from "../components/meetings/MeetingControlBar.jsx";
import TranscriptPanel from "../components/meetings/TranscriptPanel.jsx";
import LiveCaptions from "../components/meetings/LiveCaptions.jsx";
import DeviceSetupModal from "../components/meetings/DeviceSetupModal.jsx";
import useWebRTC from "../hooks/useWebRTC";
import useDevicePermission from "../hooks/useDevicePermission";
import useLiveTranscription from "../hooks/useLiveTranscription";
import useReactions from "../hooks/useReactions.js";
import ReactionBar from "../components/meetings/ReactionBar.jsx";
import ReactionOverlay from "../components/meetings/ReactionOverlay.jsx";

const MeetingRoom = () => {
  const { roomId } = useParams();
  const [duration, setDuration] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  // Transcription state
  const [showCaptions] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [captions, setCaptions] = useState([]);
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(false);

  // Device permission setup
  const [deviceSetupDone, setDeviceSetupDone] = useState(false);
  const permission = useDevicePermission();

  // WebRTC
  const {
    joined,
    loading,
    meetingEnded,
    micOn,
    cameraOn,
    isScreenSharing,
    peers,
    socketRef,
    userVideoRef,
    streamRef,
    joinMeeting,
    leaveMeeting,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
  } = useWebRTC(roomId, {
    showCaptions,
    setCaptions,
    setTranscriptSegments,
    setTranscriptionEnabled,
  });

  // Transcription
  const { toggleTranscription } = useLiveTranscription(
    roomId,
    socketRef,
    streamRef,
  );

  // Reactions
  const { reactions, sendReaction, onCooldown } = useReactions(
    roomId,
    socketRef,
  );

  useEffect(() => {
    let timer;
    if (joined && !meetingEnded) {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [joined, meetingEnded]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Meeting link copied!");
  };

  const handleJoinWithStream = (stream) => {
    setDeviceSetupDone(true);
    joinMeeting(stream);
  };

  const handleJoinWithout = () => {
    setDeviceSetupDone(true);
    joinMeeting(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 relative overflow-hidden font-sans">
      {/* ---------- DEVICE SETUP / INTRO SCREEN ---------- */}
      {!joined && !meetingEnded && !deviceSetupDone && (
        <DeviceSetupModal
          permission={permission}
          onJoin={handleJoinWithStream}
          onContinueWithout={handleJoinWithout}
        />
      )}

      {!joined && !meetingEnded && deviceSetupDone && loading && (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-900">
          <Loader2 className="animate-spin text-indigo-500" size={40} />
          <p className="text-gray-400 mt-4 text-lg">Connecting to meeting...</p>
        </div>
      )}

      {/* ---------- ACTIVE MEETING SCREEN ---------- */}
      {joined && !meetingEnded && (
        <div className="flex-1 flex flex-col min-h-0 bg-gray-900 relative">
          <ReactionOverlay reactions={reactions} />

          <MeetingHeader
            roomId={roomId}
            duration={duration}
            peers={peers}
            copyLink={copyLink}
            showNotes={showNotes}
            setShowNotes={setShowNotes}
            transcriptionEnabled={transcriptionEnabled}
            toggleTranscription={toggleTranscription}
            showTranscript={showTranscript}
            setShowTranscript={setShowTranscript}
          />

          {/* Main content area: video grid + notes panel */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Video Grid */}
            <div
              className={`flex-1 p-6 overflow-y-auto bg-gray-900 flex items-center justify-center transition-all duration-300 ${
                showNotes ? "hidden md:flex" : "flex"
              }`}
            >
              <div className="w-full h-full max-w-5xl flex flex-col md:flex-row gap-6 items-center justify-center min-h-[300px]">
                {/* Local Stream */}
                <div className="relative bg-black rounded-2xl overflow-hidden shadow-lg aspect-video flex-1 min-w-[280px] max-w-[600px] border border-gray-800">
                  <video
                    ref={userVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {!cameraOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                      <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl">
                        You
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-sm text-white text-sm flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${micOn ? "bg-green-500" : "bg-red-500"}`}
                    />
                    <span>You</span>
                  </div>
                </div>

                {/* Remote Streams */}
                {peers.map((peerObj) => (
                  <PeerVideo
                    key={peerObj.peerID}
                    peer={peerObj.peer}
                    userInfo={peerObj.userInfo}
                  />
                ))}
              </div>
            </div>

            {/* Collaborative Notes Panel */}
            {showNotes && (
              <div className="w-full md:w-[420px] lg:w-[480px] shrink-0 p-4 bg-gray-950 border-l border-gray-800 overflow-hidden flex flex-col">
                <CollaborativeEditor meetingId={roomId} />
              </div>
            )}

            {/* Transcript Panel */}
            <TranscriptPanel
              showTranscript={showTranscript}
              setShowTranscript={setShowTranscript}
              transcriptSegments={transcriptSegments}
            />
          </div>

          <LiveCaptions showCaptions={showCaptions} captions={captions} />

          <ReactionBar sendReaction={sendReaction} onCooldown={onCooldown} />

          <MeetingControlBar
            micOn={micOn}
            toggleMic={toggleMic}
            cameraOn={cameraOn}
            toggleCamera={toggleCamera}
            isScreenSharing={isScreenSharing}
            toggleScreenShare={toggleScreenShare}
            leaveMeeting={leaveMeeting}
          />
        </div>
      )}

      {/* ---------- AI PROCESSING SCREEN ---------- */}
      {meetingEnded && (
        <div className="flex-1 flex flex-col items-center justify-center text-center bg-gray-50 dark:bg-slate-900 z-30">
          <CheckCircle2 className="text-green-500" size={64} />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mt-3">
            Processing Meeting Data...
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-3 max-w-md leading-relaxed">
            Our AI is preparing your <strong>transcript</strong> and{" "}
            <strong>Minutes of Meeting</strong>.
          </p>
          <Loader2 className="animate-spin text-indigo-600 mt-5" size={28} />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Redirecting you to dashboard...
          </p>
        </div>
      )}
    </div>
  );
};

export default MeetingRoom;
