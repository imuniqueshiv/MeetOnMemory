import { useState, useRef } from "react";
import { io } from "socket.io-client";
import Peer from "simple-peer";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

export default function useWebRTC(roomId, callbacks) {
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [mediaError, setMediaError] = useState(null);

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peers, setPeers] = useState([]);

  const socketRef = useRef(null);
  const userVideoRef = useRef(null);
  const streamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const peersRef = useRef([]);

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
      const userInfo = { name: "You" };

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

      // Transcription events from callbacks
      socketRef.current.on("transcript-partial", (data) => {
        if (callbacks.showCaptions) {
          callbacks.setCaptions((prev) => [
            ...prev.slice(-4),
            { text: data.text, isFinal: false, timestamp: data.timestamp },
          ]);
        }
      });

      socketRef.current.on("transcript-final", (data) => {
        const { segment } = data;
        callbacks.setCaptions((prev) => [
          ...prev.slice(-4),
          {
            text: segment.text,
            speaker: segment.speaker,
            isFinal: true,
            timestamp: data.timestamp,
          },
        ]);
        callbacks.setTranscriptSegments((prev) => [...prev, segment]);
      });

      socketRef.current.on("transcription-started", () => {
        callbacks.setTranscriptionEnabled(true);
        toast.success("🎙️ Live transcription started");
      });

      socketRef.current.on("transcription-stopped", () => {
        callbacks.setTranscriptionEnabled(false);
        toast.info("🎙️ Live transcription stopped");
      });

      socketRef.current.on("transcription-error", (data) => {
        toast.error(`Transcription error: ${data.message}`);
        callbacks.setTranscriptionEnabled(false);
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

        screenTrack.onended = () => stopScreenShare();

        if (userVideoRef.current) userVideoRef.current.srcObject = screenStream;
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
    if (userVideoRef.current)
      userVideoRef.current.srcObject = streamRef.current;
    setIsScreenSharing(false);
  };

  return {
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
  };
}
