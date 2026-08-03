import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Peer from "simple-peer";
import { toast } from "react-toastify";
import {
  Loader2,
  CheckCircle2,
  Clock,
  Users,
  Copy,
  PanelRightClose,
  NotebookPen,
  Captions,
  FileText,
} from "lucide-react";
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
  const navigate = useNavigate();

  const screenTrackRef = useRef();
  const peersRef = useRef([]);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ":" : ""}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [mediaError, setMediaError] = useState(null);

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [peers, setPeers] = useState([]);

  // Shared Timer State
  const [timerState, setTimerState] = useState({
    isRunning: false,
    elapsed: 0,
    remaining: 0,
    currentAgendaItem: null,
  });
  const timerStateRef = useRef(timerState);

  // eslint-disable-next-line no-unused-vars
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
  const { socketRef, userVideoRef, streamRef } = useWebRTC(roomId, {
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

  // Local timer tick for smooth UI updates
  useEffect(() => {
    let interval;
    if (timerState.isRunning && !meetingEnded) {
      interval = setInterval(() => {
        setTimerState((prev) => {
          const next = {
            ...prev,
            elapsed: prev.elapsed + 1,
            remaining: Math.max(0, prev.remaining - 1),
          };
          timerStateRef.current = next;
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerState.isRunning, meetingEnded]);

  const joinMeeting = async () => {
    try {
      setLoading(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;
      setJoined(true);

      setTimeout(() => {
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
        }
      }, 100);

      socketRef.current = io(backendUrl, { transports: ["websocket"] });

      const userInfo = { name: "You" }; // In a real app, grab from context

      socketRef.current.emit("join-meeting", { roomId, userInfo });

      socketRef.current.on("all-users", (users) => {
        const peersArr = [];
        users.forEach((user) => {
          const peer = createPeer(user.socketId, socketRef.current.id, stream);
          peersRef.current.push({
            peerID: user.socketId,
            peer,
            userInfo: user,
          });
          peersArr.push({
            peerID: user.socketId,
            peer,
            userInfo: user,
          });
        });
        setPeers(peersArr);
      });

      socketRef.current.on("user-joined", (user) => {
        toast.info(`👋 Participant joined`);
        const peer = addPeer(user.socketId, socketRef.current.id, stream);
        peersRef.current.push({
          peerID: user.socketId,
          peer,
          userInfo: user,
        });

        setPeers([...peersRef.current]);
      });

      // Timer synchronization event
      socketRef.current.on("timer-sync", (serverState) => {
        setTimerState((prev) => ({ ...prev, ...serverState }));
        timerStateRef.current = { ...timerStateRef.current, ...serverState };
      });

      socketRef.current.on("user-joined-signal", (payload) => {
        const item = peersRef.current.find(
          (p) => p.peerID === payload.callerID,
        );
        if (item) {
          item.peer.signal(payload.signal);
        }
      });

      socketRef.current.on("receiving-returned-signal", (payload) => {
        const item = peersRef.current.find((p) => p.peerID === payload.id);
        if (item) {
          item.peer.signal(payload.signal);
        }
      });

      socketRef.current.on("user-left", (id) => {
        toast.error(`🚪 Participant left`);
        const peerObj = peersRef.current.find((p) => p.peerID === id);
        if (peerObj) {
          peerObj.peer.destroy();
        }
        peersRef.current = peersRef.current.filter((p) => p.peerID !== id);
        setPeers([...peersRef.current]);
      });

      // Transcription events
      socketRef.current.on("transcript-partial", (data) => {
        if (showCaptions) {
          setCaptions((prev) => [
            ...prev.slice(-4),
            { text: data.text, isFinal: false, timestamp: data.timestamp },
          ]);
        }
      });

      socketRef.current.on("transcript-final", (data) => {
        const { segment } = data;
        setCaptions((prev) => [
          ...prev.slice(-4),
          {
            text: segment.text,
            speaker: segment.speaker,
            isFinal: true,
            timestamp: data.timestamp,
          },
        ]);
        setTranscriptSegments((prev) => [...prev, segment]);
      });

      socketRef.current.on("transcription-started", () => {
        setTranscriptionEnabled(true);
        toast.success("🎙️ Live transcription started");
      });

      socketRef.current.on("transcription-stopped", () => {
        setTranscriptionEnabled(false);
        toast.info("🎙️ Live transcription stopped");
      });

      socketRef.current.on("transcription-error", (data) => {
        toast.error(`Transcription error: ${data.message}`);
        setTranscriptionEnabled(false);
      });

      setLoading(false);
    } catch (err) {
      console.error("Camera/Mic access denied:", err);
      let errMsg =
        "Camera or microphone access denied. Please enable them and retry.";
      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errMsg = "Required media devices (camera or microphone) not found.";
      } else if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        errMsg =
          "Permission denied. Please allow camera and microphone access in your browser settings.";
      }
      setMediaError(errMsg);
      toast.error(errMsg);
      setLoading(false);
    }
  };

  const createPeer = (userToSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socketRef.current.emit("sending-signal", {
        userToSignal,
        callerID,
        signal,
        userInfo: { name: "You" },
      });
    });

    return peer;
  };

  const addPeer = (incomingSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socketRef.current.emit("returning-signal", { signal, callerID });
    });

    return peer;
  };

  const leaveMeeting = () => {
    setMeetingEnded(true);

    streamRef.current?.getTracks().forEach((track) => track.stop());
    screenTrackRef.current?.getTracks().forEach((track) => track.stop());

    socketRef.current?.disconnect();

    setJoined(false);

    setTimeout(() => {
      setMeetingEnded(false);
      navigate("/dashboard");
    }, 4000);
  };

  // Toggle Media Handlers
  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !micOn;
        setMicOn(!micOn);
      }
    }
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !cameraOn;
        setCameraOn(!cameraOn);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: true },
        });
        const screenTrack = screenStream.getVideoTracks()[0];

        peersRef.current.forEach(({ peer }) => {
          const videoTrack = streamRef.current.getVideoTracks()[0];
          peer.replaceTrack(videoTrack, screenTrack, streamRef.current);
        });

        screenTrack.onended = () => {
          stopScreenShare();
        };

        userVideoRef.current.srcObject = screenStream;
        screenTrackRef.current = screenStream;
        setIsScreenSharing(true);
      } catch (err) {
        console.error("Screen share failed", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    const videoTrack = streamRef.current.getVideoTracks()[0];
    peersRef.current.forEach(({ peer }) => {
      const currentTrack = screenTrackRef.current?.getTracks()[0];
      if (currentTrack) {
        peer.replaceTrack(currentTrack, videoTrack, streamRef.current);
      }
    });

    screenTrackRef.current?.getTracks().forEach((t) => t.stop());
    userVideoRef.current.srcObject = streamRef.current;
    setIsScreenSharing(false);
  };

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
          {/* Header */}
          <div className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 z-20 shrink-0">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-white truncate max-w-xs md:max-w-md">
                Room: {roomId}
              </h2>
              <div className="flex items-center gap-2 text-gray-300 bg-gray-800 px-3 py-1 rounded-full text-sm font-mono">
                <Clock size={14} />
                <span>{formatTime(timerState.elapsed)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300 bg-gray-800 px-3 py-1 rounded-full text-sm">
                <Users size={16} />
                <span>{peers.length + 1}</span>
              </div>
            </div>

            <button
              onClick={copyLink}
              className="text-gray-300 hover:text-white flex items-center gap-1.5 text-sm font-semibold bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              <Copy size={16} />
              <span className="hidden sm:inline">Copy Link</span>
            </button>

            {/* Notes Toggle */}
            <button
              onClick={() => setShowNotes((v) => !v)}
              className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
                showNotes
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
              }`}
              title={showNotes ? "Hide notes" : "Open collaborative notes"}
            >
              {showNotes ? (
                <PanelRightClose size={16} />
              ) : (
                <NotebookPen size={16} />
              )}
              <span className="hidden sm:inline">
                {showNotes ? "Hide Notes" : "Notes"}
              </span>
            </button>

            {/* Transcription Toggle */}
            <button
              onClick={toggleTranscription}
              className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
                transcriptionEnabled
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
              }`}
              title={
                transcriptionEnabled
                  ? "Stop transcription"
                  : "Start live transcription"
              }
            >
              <Captions size={16} />
              <span className="hidden sm:inline">
                {transcriptionEnabled ? "Stop" : "Captions"}
              </span>
            </button>

            {/* Transcript Toggle */}
            <button
              onClick={() => setShowTranscript((v) => !v)}
              className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer ${
                showTranscript
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
              }`}
              title={showTranscript ? "Hide transcript" : "Show transcript"}
            >
              <FileText size={16} />
              <span className="hidden sm:inline">
                {showTranscript ? "Hide" : "Transcript"}
              </span>
            </button>
          </div>
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
