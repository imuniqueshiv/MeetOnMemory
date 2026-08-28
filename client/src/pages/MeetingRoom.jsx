import React, {
  useCallback,
  useEffect,
  useState,
  useRef,
  useContext,
  useMemo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth } from "@clerk/clerk-react";
import Peer from "simple-peer";
import { toast } from "react-toastify";
import { Loader2, CheckCircle2 } from "lucide-react";
import CollaborativeEditor from "../components/meetings/CollaborativeEditor.jsx";
import ParkingLotPanel from "../components/meetings/ParkingLotPanel.jsx";
import BreakoutRoomPanel from "../components/meeting-room/BreakoutRoomPanel.jsx";
import PollSection from "../components/meeting-details/PollSection.jsx";
import AgendaTimer from "../components/meeting-details/AgendaTimer.jsx";
import PeerVideo from "../components/meetings/PeerVideo.jsx";
import MeetingHeader from "../components/meetings/MeetingHeader.jsx";
import MeetingControlBar from "../components/meetings/MeetingControlBar.jsx";
import TranscriptPanel from "../components/meetings/TranscriptPanel.jsx";
import MultiLanguageTranscript from "../components/meeting-room/MultiLanguageTranscript.jsx";
import LiveCaptions from "../components/meetings/LiveCaptions.jsx";
import DeviceSetupModal from "../components/meetings/DeviceSetupModal.jsx";
import axios from "../services/apiClient.js";
import FacilitatorDashboard from "./FacilitatorDashboard.jsx";
import useWebRTC from "../hooks/useWebRTC";
import useDevicePermission from "../hooks/useDevicePermission";
import useLiveTranscription from "../hooks/useLiveTranscription";
import useReactions from "../hooks/useReactions.js";
import ReactionBar from "../components/meetings/ReactionBar.jsx";
import ReactionOverlay from "../components/meetings/ReactionOverlay.jsx";
import {
  getMeetingVideoGridClass,
  MEETING_VIDEO_TILE_CLASS,
} from "../utils/meetingVideoGrid.js";
import {
  getTrackEnabledState,
  resolveMeetingMediaStream,
} from "../utils/mediaStream.js";
import AppContent from "../context/AppContent.js";
import {
  createClerkSocketOptions,
  getClerkBearerToken,
} from "../services/apiClient.js";
import ConsentModal from "../components/meetings/ConsentModal.jsx";
import useRecordingConsent from "../hooks/useRecordingConsent.js";

/** Build join/signaling identity from authenticated AppContext user (Issue #1211). */
const buildLocalUserInfo = (userData) => ({
  id: userData?._id || userData?.id || undefined,
  name: userData?.name || "Participant",
  email: userData?.email || "",
  profilePic: userData?.profilePic || "",
});

/** Side panel ids for exclusive panel visibility (Issue #1648). */
const MEETING_ROOM_PANELS = {
  NOTES: "notes",
  PARKING_LOT: "parkingLot",
  TRANSCRIPT: "transcript",
  BREAKOUT_ROOMS: "breakoutRooms",
  POLLS: "polls",
  AGENDA: "agenda",
};

const MeetingRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { userData } = useContext(AppContent);
  const { isSignedIn, isLoaded, userId } = useAuth();
  const [socket, setSocket] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const localUserInfo = useMemo(() => buildLocalUserInfo(userData), [userData]);
  const localUserInfoRef = useRef(localUserInfo);
  localUserInfoRef.current = localUserInfo;

  const screenTrackRef = useRef();
  const peersRef = useRef([]);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

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

  const [activePanel, setActivePanel] = useState(null);

  const togglePanel = useCallback((panel) => {
    setActivePanel((current) => (current === panel ? null : panel));
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const showNotes = activePanel === MEETING_ROOM_PANELS.NOTES;
  const showParkingLot = activePanel === MEETING_ROOM_PANELS.PARKING_LOT;
  const showTranscript = activePanel === MEETING_ROOM_PANELS.TRANSCRIPT;
  const showBreakoutRooms = activePanel === MEETING_ROOM_PANELS.BREAKOUT_ROOMS;
  const showPolls = activePanel === MEETING_ROOM_PANELS.POLLS;
  const showAgenda = activePanel === MEETING_ROOM_PANELS.AGENDA;

  // Transcription state
  const [showCaptions] = useState(true);
  const [captions, setCaptions] = useState([]);
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(false);

  // Device permission setup
  const [deviceSetupDone, setDeviceSetupDone] = useState(false);
  const permission = useDevicePermission();

  // ── Recording Consent (Issue #2247) ──────────────────────────────────
  const {
    hasConsent: hasRoomConsent,
    showModal: showRoomConsentModal,
    handleAccept: handleRoomConsentAccept,
    handleDecline: handleRoomConsentDecline,
  } = useRecordingConsent({
    meetingId: roomId,
    context: "room",
    persistToServer: true,
  });

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
  const { reactions, sendReaction, onCooldown } = useReactions(roomId, socket);

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

  useEffect(() => {
    if (!roomId) return;
    const fetchMeetingData = async () => {
      try {
        const [meetingRes, rolesRes] = await Promise.all([
          axios.get(`/api/meetings/${roomId}`),
          axios.get(`/api/meetings/${roomId}/roles`),
        ]);
        setMeeting(meetingRes.data.meeting);
        const myRoleObj = rolesRes.data.find(
          (r) => r.userId?._id === userId || r.userId === userId,
        );
        if (myRoleObj) {
          setUserRole(myRoleObj.role);
        }
      } catch (error) {
        console.error("Failed to fetch meeting data:", error);
      }
    };
    fetchMeetingData();
  }, [roomId, userId]);

  const setupSocketListeners = (activeSocket) => {
    const userInfo = localUserInfoRef.current;
    activeSocket.emit("join-meeting", { roomId, userInfo });

    activeSocket.on("reconnect_attempt", async () => {
      const token = await getClerkBearerToken();
      if (activeSocket.auth) {
        activeSocket.auth.token = token;
      } else {
        activeSocket.auth = { token };
      }
    });

    activeSocket.on("all-users", (users) => {
      const peersArr = [];
      users.forEach((user) => {
        const peer = createPeer(
          user.socketId,
          activeSocket.id,
          streamRef.current,
        );
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

    activeSocket.on("user-joined", (user) => {
      toast.info(`👋 Participant joined`);
      const peer = addPeer(user.socketId, activeSocket.id, streamRef.current);
      peersRef.current.push({
        peerID: user.socketId,
        peer,
        userInfo: user,
      });

      setPeers([...peersRef.current]);
    });

    // Timer synchronization event
    activeSocket.on("timer-sync", (serverState) => {
      setTimerState((prev) => ({ ...prev, ...serverState }));
      timerStateRef.current = { ...timerStateRef.current, ...serverState };
    });

    activeSocket.on("user-joined-signal", (payload) => {
      const item = peersRef.current.find((p) => p.peerID === payload.callerID);
      if (item) {
        item.peer.signal(payload.signal);
      }
    });

    activeSocket.on("receiving-returned-signal", (payload) => {
      const item = peersRef.current.find((p) => p.peerID === payload.id);
      if (item) {
        item.peer.signal(payload.signal);
      }
    });

    activeSocket.on("user-left", (id) => {
      toast.error(`🚪 Participant left`);
      const peerObj = peersRef.current.find((p) => p.peerID === id);
      if (peerObj) {
        peerObj.peer.destroy();
      }
      peersRef.current = peersRef.current.filter((p) => p.peerID !== id);
      setPeers([...peersRef.current]);
    });

    // Transcription events
    activeSocket.on("transcript-partial", (data) => {
      if (showCaptions) {
        setCaptions((prev) => [
          ...prev.slice(-4),
          { text: data.text, isFinal: false, timestamp: data.timestamp },
        ]);
      }
    });

    activeSocket.on("transcript-final", (data) => {
      const { segment } = data;
      setCaptions((prev) => {
        // Check for exact duplicate in captions
        const exists = prev.some(
          (c) => c.text === segment.text && c.timestamp === data.timestamp,
        );
        if (exists) return prev;
        return [
          ...prev.slice(-4),
          {
            text: segment.text,
            speaker: segment.speaker,
            isFinal: true,
            timestamp: data.timestamp,
          },
        ];
      });
      setTranscriptSegments((prev) => {
        const exists = prev.some(
          (s) =>
            s.startTime === segment.startTime &&
            s.text === segment.text &&
            s.speaker === segment.speaker,
        );
        if (exists) return prev;
        return [...prev, segment];
      });
    });

    activeSocket.on("transcription-started", () => {
      setTranscriptionEnabled(true);
      toast.success("🎙️ Live transcription started");
    });

    activeSocket.on("transcription-stopped", () => {
      setTranscriptionEnabled(false);
      toast.info("🎙️ Live transcription stopped");
    });

    activeSocket.on("transcription-error", (data) => {
      toast.error(`Transcription error: ${data.message}`);
      setTranscriptionEnabled(false);
    });
  };

  // Connect & Rebind socket dynamically when Clerk session or token changes
  useEffect(() => {
    if (!joined || !isSignedIn || !isLoaded) return;

    let active = true;
    let newSocket = null;

    const connectAndBind = async () => {
      try {
        setLoading(true);
        // Clear previous connection
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
          setSocket(null);
        }

        const opts = await createClerkSocketOptions({
          transports: ["websocket"],
        });
        if (!active) return;

        newSocket = io(backendUrl, opts);
        socketRef.current = newSocket;
        setSocket(newSocket);

        setupSocketListeners(newSocket);
        setLoading(false);
      } catch (err) {
        console.error("Socket rebinding error:", err);
        setLoading(false);
      }
    };

    connectAndBind();

    return () => {
      active = false;
      if (newSocket) {
        newSocket.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isSignedIn, isLoaded, joined, backendUrl]);

  const joinMeeting = async (providedStream = null, joinOptions = {}) => {
    try {
      setLoading(true);

      const { mode = null } = joinOptions;
      const stream = await resolveMeetingMediaStream({
        providedStream,
        mode,
        videoDeviceId: permission.selectedCamera,
        audioDeviceId: permission.selectedMicrophone,
      });

      streamRef.current = stream;
      const trackState = getTrackEnabledState(stream);
      setMicOn(trackState.micOn);
      setCameraOn(trackState.cameraOn);
      setJoined(true);

      setTimeout(() => {
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
        }
      }, 100);

      // Loading state will be turned off in the react socket useEffect upon successful connect
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
      setDeviceSetupDone(false);
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
        // Server ignores this and uses authenticated socket.user (#1211).
        userInfo: localUserInfoRef.current,
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

  const leaveMeeting = useCallback(() => {
    setMeetingEnded(true);

    streamRef.current?.getTracks().forEach((track) => track.stop());
    screenTrackRef.current?.getTracks().forEach((track) => track.stop());

    socketRef.current?.disconnect();

    setJoined(false);
    setSocket(null);

    setTimeout(() => {
      setMeetingEnded(false);
      navigate("/dashboard");
    }, 4000);
  }, [navigate, socketRef, streamRef]);

  // Cleanly handle logout during an active meeting
  useEffect(() => {
    if (joined && isLoaded && !isSignedIn) {
      leaveMeeting();
    }
  }, [isSignedIn, isLoaded, joined, leaveMeeting]);

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

  // ── Consent-gated join handlers (Issue #2247) ──────────────────────
  const handleJoinWithStream = (stream) => {
    if (!hasRoomConsent) {
      showRoomConsentModal();
      return;
    }
    permission.releaseStream();
    setDeviceSetupDone(true);
    joinMeeting(stream);
  };

  const handleJoinWithout = (mode = "observer") => {
    permission.releaseStream();
    setDeviceSetupDone(true);
    joinMeeting(null, { mode });
  };

  const handleRoomConsentAccepted = async () => {
    await handleRoomConsentAccept();
  };

  const handleRoomConsentDeclined = () => {
    handleRoomConsentDecline();
    toast.info("Room access cancelled — consent declined.");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 relative overflow-hidden font-sans">
      {/* Recording Consent Modal (Issue #2247) */}
      <ConsentModal
        isOpen={showRoomConsentModal}
        onAccept={handleRoomConsentAccepted}
        onDecline={handleRoomConsentDeclined}
        context="room"
        isRequired={true}
      />
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
      {joined && !meetingEnded && userRole === "facilitator" && meeting && (
        <div className="flex-1 flex flex-col min-h-0">
          <AgendaTimer
            meeting={meeting}
            socket={socketRef?.current || socket}
          />
          <FacilitatorDashboard
            meeting={meeting}
            onAdvanceAgenda={() => {
              // emit socket event to advance agenda
            }}
            onNudgeParticipant={() => {
              toast.success("Nudge sent to participant");
            }}
          />
        </div>
      )}

      {joined && !meetingEnded && userRole !== "facilitator" && (
        <div className="flex-1 flex flex-col min-h-0 bg-gray-900 relative">
          <MeetingHeader
            roomId={roomId}
            duration={timerState.elapsed}
            peers={peers}
            copyLink={copyLink}
            activePanel={activePanel}
            onTogglePanel={togglePanel}
            transcriptionEnabled={transcriptionEnabled}
            toggleTranscription={toggleTranscription}
          />
          <ReactionOverlay reactions={reactions} />

          {meeting && (
            <AgendaTimer
              meeting={meeting}
              socket={socketRef?.current || socket}
              compact
            />
          )}

          {/* Main content area: video grid + notes panel */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Video Grid — responsive by participant count + viewport (#907) */}
            <div
              className={`flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden bg-gray-900 transition-all duration-300 ${
                activePanel ? "hidden md:block" : "block"
              }`}
            >
              <div
                className={`grid gap-2 sm:gap-3 md:gap-4 p-2 sm:p-4 md:p-6 content-center justify-items-stretch min-h-full ${getMeetingVideoGridClass(
                  peers.length + 1,
                )}`}
              >
                {/* Local Stream */}
                <div className={MEETING_VIDEO_TILE_CLASS}>
                  <video
                    ref={userVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {!cameraOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                      {localUserInfo.profilePic ? (
                        <img
                          src={localUserInfo.profilePic}
                          alt=""
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-xl"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-600 rounded-full flex items-center justify-center text-2xl sm:text-3xl font-bold text-white shadow-xl">
                          {(localUserInfo.name || "P").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-black/60 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg backdrop-blur-sm text-white text-xs sm:text-sm flex items-center gap-2 max-w-[calc(100%-1rem)]">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${micOn ? "bg-green-500" : "bg-red-500"}`}
                    />
                    <span className="truncate">{localUserInfo.name}</span>
                    {userRole === "scribe" && (
                      <span className="ml-1 bg-blue-500/20 text-blue-300 text-[10px] px-1.5 py-0.5 rounded border border-blue-500/30">
                        📝 Scribe
                      </span>
                    )}
                    {userRole === "timekeeper" && (
                      <span className="ml-1 bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30">
                        ⏱️ Timekeeper
                      </span>
                    )}
                    {isScreenSharing && (
                      <span className="text-[10px] sm:text-xs text-indigo-300 shrink-0">
                        Sharing
                      </span>
                    )}
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
              <div
                data-testid="meeting-room-notes-panel"
                className="w-full md:w-[420px] lg:w-[480px] shrink-0 p-4 bg-gray-950 border-l border-gray-800 overflow-hidden flex flex-col transition-all duration-300"
              >
                <CollaborativeEditor meetingId={roomId} />
              </div>
            )}

            {/* Parking Lot Panel */}
            {showParkingLot && (
              <div
                data-testid="meeting-room-parking-lot-panel"
                className="w-full md:w-[320px] lg:w-[360px] shrink-0 bg-gray-950 border-l border-gray-800 overflow-hidden flex flex-col transition-all duration-300"
              >
                <ParkingLotPanel
                  organizationId={
                    userData?.currentOrganization?._id ||
                    userData?.organizations?.[0]
                  }
                  meetingId={roomId}
                />
              </div>
            )}

            {/* Breakout Rooms Panel */}
            {showBreakoutRooms && (
              <div
                data-testid="meeting-room-breakout-rooms-panel"
                className="w-full md:w-[360px] lg:w-[400px] shrink-0 bg-gray-950 border-l border-gray-800 overflow-hidden flex flex-col transition-all duration-300"
              >
                <BreakoutRoomPanel
                  meetingId={roomId}
                  isHost={
                    userData?.role === "admin" ||
                    userData?.role === "host" ||
                    true
                  }
                  currentUserId={userData?._id || userId}
                  socket={socketRef?.current || socket}
                />
              </div>
            )}

            {showPolls && (
              <div
                data-testid="meeting-room-polls-panel"
                className="w-full md:w-[360px] lg:w-[400px] shrink-0 p-4 bg-gray-950 border-l border-gray-800 overflow-y-auto flex flex-col transition-all duration-300"
              >
                <PollSection
                  meetingId={roomId}
                  socket={socketRef?.current || socket}
                  title="Live Polls"
                />
              </div>
            )}

            {showAgenda && (
              <div
                data-testid="meeting-room-agenda-panel"
                className="w-full md:w-[360px] lg:w-[400px] shrink-0 p-4 bg-gray-950 border-l border-gray-800 overflow-y-auto flex flex-col transition-all duration-300"
              >
                {meeting ? (
                  <AgendaTimer
                    meeting={meeting}
                    socket={socketRef?.current || socket}
                  />
                ) : null}
              </div>
            )}

            {/* Transcript Panel */}
            <TranscriptPanel
              showTranscript={showTranscript}
              onClose={closePanel}
              transcriptSegments={transcriptSegments}
              meetingId={roomId}
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
