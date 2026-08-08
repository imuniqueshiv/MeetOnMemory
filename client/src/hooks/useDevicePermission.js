import { useState, useEffect, useCallback, useRef } from "react";

const BROWSER_GUIDES = {
  Chrome: {
    name: "Chrome",
    steps: [
      'Click the 🔒 icon (or "Not secure") next to the address bar.',
      "Find Camera and Microphone in the list.",
      "Change each to Allow.",
      "Refresh the page.",
    ],
  },
  Edge: {
    name: "Edge",
    steps: [
      "Click the 🔒 icon next to the address bar.",
      'Select "Site permissions".',
      "Set Camera and Microphone to Allow.",
      "Refresh the page.",
    ],
  },
  Firefox: {
    name: "Firefox",
    steps: [
      "Click the 🔒 icon next to the address bar.",
      'Click "Connection secure" > "More information".',
      'Under "Permissions", check "Use the microphone" and "Use the camera".',
      'Click "Allow" and refresh.',
    ],
  },
  Safari: {
    name: "Safari",
    steps: [
      "Open Safari > Settings > Websites.",
      "Find Camera and Microphone on the left.",
      "Set this site to Allow.",
      "Refresh the page.",
    ],
  },
};

function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  return "Chrome";
}

function getBrowserGuide() {
  const name = detectBrowser();
  return BROWSER_GUIDES[name] || BROWSER_GUIDES.Chrome;
}

export default function useDevicePermission() {
  const [cameraStatus, setCameraStatus] = useState("prompt");
  const [micStatus, setMicStatus] = useState("prompt");
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMicrophone, setSelectedMicrophone] = useState("");
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);
  // Tracks ownership of the preview MediaStream so Device Setup can hand it
  // off to Meeting Room without cleanup() stopping live tracks (#1210).
  const streamRef = useRef(null);

  const stopAudioAnalyser = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    setAudioLevel(0);
  }, []);

  const startAudioAnalyser = useCallback(
    (mediaStream) => {
      stopAudioAnalyser();
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const source = ctx.createMediaStreamSource(mediaStream);
        source.connect(analyser);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(Math.min(avg / 128, 1));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // Audio level detection unsupported
      }
    },
    [stopAudioAnalyser],
  );

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      const mics = devices.filter((d) => d.kind === "audioinput");
      setCameras(cams);
      setMicrophones(mics);
      if (cams.length > 0 && !selectedCamera)
        setSelectedCamera(cams[0].deviceId);
      if (mics.length > 0 && !selectedMicrophone)
        setSelectedMicrophone(mics[0].deviceId);
      return { cameras: cams, microphones: mics };
    } catch {
      return { cameras: [], microphones: [] };
    }
  }, [selectedCamera, selectedMicrophone]);

  const checkPermissions = useCallback(async () => {
    try {
      if (navigator.permissions?.query) {
        const camResult = await navigator.permissions.query({ name: "camera" });
        setCameraStatus(camResult.state);
        camResult.onchange = () => setCameraStatus(camResult.state);

        const micResult = await navigator.permissions.query({
          name: "microphone",
        });
        setMicStatus(micResult.state);
        micResult.onchange = () => setMicStatus(micResult.state);
      }
    } catch {
      // Permissions API unsupported — fall back to getUserMedia
    }
    setChecked(true);
  }, []);

  const requestMedia = useCallback(
    async (opts = {}) => {
      const { video = true, audio = true } = opts;
      setLoading(true);
      setError(null);
      setErrorType(null);

      try {
        const constraints = {};
        if (video) {
          constraints.video = selectedCamera
            ? { deviceId: { exact: selectedCamera } }
            : true;
        }
        if (audio) {
          constraints.audio = selectedMicrophone
            ? { deviceId: { exact: selectedMicrophone } }
            : true;
        }

        const mediaStream =
          await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = mediaStream;
        setStream(mediaStream);
        setCameraStatus("granted");
        setMicStatus("granted");

        if (audio) startAudioAnalyser(mediaStream);

        await enumerateDevices();
        setLoading(false);
        return mediaStream;
      } catch (err) {
        let type = "generic";
        let msg = "Camera or microphone access denied.";

        if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError"
        ) {
          type = "not-found";
          msg =
            video && audio
              ? "No camera or microphone detected. Please connect a device."
              : video
                ? "No camera detected."
                : "No microphone detected.";
        } else if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          type = "blocked";
          msg =
            "Camera and microphone access is blocked. Please update your browser permissions.";
        } else if (err.name === "NotReadableError") {
          type = "in-use";
          msg =
            "Your camera or microphone is being used by another application (Zoom, Teams, etc.). Please close it and try again.";
        } else if (err.name === "OverconstrainedError") {
          type = "overconstrained";
          msg =
            "The selected device is not available. Try a different camera or microphone.";
        } else if (err.name === "AbortError") {
          type = "generic";
          msg = "Device access was aborted. Please try again.";
        }

        setError(msg);
        setErrorType(type);
        setLoading(false);
        return null;
      }
    },
    [selectedCamera, selectedMicrophone, enumerateDevices, startAudioAnalyser],
  );

  const switchCamera = useCallback(async (deviceId) => {
    setSelectedCamera(deviceId);
    const current = streamRef.current;
    if (current) {
      current.getVideoTracks().forEach((t) => t.stop());
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: false,
        });
        const videoTrack = newStream.getVideoTracks()[0];
        current.addTrack(videoTrack);
        // Keep the same MediaStream instance so callers holding a reference
        // (preview / pending join) continue to see updated tracks.
        streamRef.current = current;
        setStream(current);
        newStream.getTracks().forEach((t) => {
          if (t !== videoTrack) t.stop();
        });
      } catch {
        // Fallback — will be refreshed on next requestMedia
      }
    }
  }, []);

  const switchMicrophone = useCallback(
    async (deviceId) => {
      setSelectedMicrophone(deviceId);
      const current = streamRef.current;
      if (current) {
        current.getAudioTracks().forEach((t) => t.stop());
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: deviceId } },
            video: false,
          });
          const audioTrack = newStream.getAudioTracks()[0];
          current.addTrack(audioTrack);
          streamRef.current = current;
          setStream(current);
          startAudioAnalyser(current);
          newStream.getTracks().forEach((t) => {
            if (t !== audioTrack) t.stop();
          });
        } catch {
          // Fallback
        }
      }
    },
    [startAudioAnalyser],
  );

  const retry = useCallback(async () => {
    stopAudioAnalyser();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    }
    const newStream = await requestMedia();
    return newStream;
  }, [requestMedia, stopAudioAnalyser]);

  /**
   * Relinquish ownership of the preview stream without stopping tracks.
   * Call before unmounting Device Setup when handing the stream to Meeting Room.
   */
  const releaseStream = useCallback(() => {
    stopAudioAnalyser();
    streamRef.current = null;
    setStream(null);
  }, [stopAudioAnalyser]);

  const cleanup = useCallback(() => {
    stopAudioAnalyser();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, [stopAudioAnalyser]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const browserGuide = getBrowserGuide();
  const isCameraGranted = cameraStatus === "granted";
  const isMicGranted = micStatus === "granted";
  const isCameraBlocked = cameraStatus === "denied";
  const isMicBlocked = micStatus === "denied";
  const cameraMissing = checked && cameras.length === 0;
  const micMissing = checked && microphones.length === 0;

  return {
    cameraStatus,
    micStatus,
    cameras,
    microphones,
    selectedCamera,
    selectedMicrophone,
    stream,
    error,
    errorType,
    loading,
    checked,
    audioLevel,
    browserGuide,
    isCameraGranted,
    isMicGranted,
    isCameraBlocked,
    isMicBlocked,
    cameraMissing,
    micMissing,
    checkPermissions,
    requestMedia,
    switchCamera,
    switchMicrophone,
    retry,
    releaseStream,
    cleanup,
    enumerateDevices,
    setSelectedCamera,
    setSelectedMicrophone,
    setError,
  };
}
