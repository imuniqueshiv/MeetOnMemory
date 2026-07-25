import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Loader2, CheckCircle2 } from "lucide-react";
import ErrorState from "../components/ErrorState.jsx";
import CollaborativeEditor from "../components/meetings/CollaborativeEditor.jsx";
import PeerVideo from "../components/meetings/PeerVideo.jsx";
import MeetingHeader from "../components/meetings/MeetingHeader.jsx";
import MeetingControlBar from "../components/meetings/MeetingControlBar.jsx";
import TranscriptPanel from "../components/meetings/TranscriptPanel.jsx";
import LiveCaptions from "../components/meetings/LiveCaptions.jsx";
import useWebRTC from "../hooks/useWebRTC";
import useLiveTranscription from "../hooks/useLiveTranscription";

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

  // WebRTC
  const {
    joined,
    loading,
    meetingEnded,
    mediaError,
    setMediaError,
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 relative overflow-hidden font-sans">
      {/* ---------- INTRO SCREEN ---------- */}
      {!joined && !meetingEnded && (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 md:px-8 text-center bg-gradient-to-br from-indigo-50 via-white to-purple-100 dark:from-slate-950 dark:via-slate-900 dark:to-purple-950/20">
          <div className="absolute top-0 left-0 w-72 h-72 bg-indigo-200 dark:bg-indigo-900/10 opacity-20 blur-3xl rounded-full animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-200 dark:bg-purple-900/10 opacity-30 blur-3xl rounded-full animate-pulse"></div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 dark:text-white mb-3 flex items-center justify-center gap-3">
            🎥 MeetOnMemory{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              Live Room
            </span>
          </h1>

          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed text-base md:text-lg">
            Join room <strong>{roomId}</strong> with real-time transcription and
            automatic AI-generated MoMs.
          </p>

          {mediaError ? (
            <div className="w-full max-w-lg mx-auto">
              <ErrorState
                title="Device Access Error"
                message={mediaError}
                onRetry={() => {
                  setMediaError(null);
                  joinMeeting();
                }}
              />
            </div>
          ) : loading ? (
            <button
              disabled
              className="px-8 py-3 bg-indigo-600 text-white rounded-full font-semibold shadow-md flex items-center justify-center gap-2 mx-auto cursor-not-allowed"
            >
              <Loader2 className="animate-spin" size={20} /> Connecting...
            </button>
          ) : (
            <button
              onClick={joinMeeting}
              className="px-8 py-3 bg-indigo-600 text-white rounded-full font-semibold shadow-md hover:bg-indigo-700 hover:shadow-xl active:scale-95 transition-all duration-300 cursor-pointer"
            >
              🚀 Join Meeting
            </button>
          )}
        </div>
      )}

      {/* ---------- ACTIVE MEETING SCREEN ---------- */}
      {joined && !meetingEnded && (
        <div className="flex-1 flex flex-col min-h-0 bg-gray-900 relative">
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
