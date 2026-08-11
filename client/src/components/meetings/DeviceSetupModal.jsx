import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  Mic,
  Monitor,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Volume2,
} from "lucide-react";

const STATUS_ICONS = {
  granted: <CheckCircle2 className="w-5 h-5 text-green-500" />,
  prompt: <HelpCircle className="w-5 h-5 text-yellow-500" />,
  denied: <XCircle className="w-5 h-5 text-red-500" />,
  unavailable: <XCircle className="w-5 h-5 text-gray-400" />,
};

const STATUS_LABELS = {
  granted: "Ready",
  prompt: "Permission needed",
  denied: "Blocked",
  unavailable: "Not detected",
};

function StatusRow({ icon, label, status, detail }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">
        {label}
      </span>
      <span className="flex items-center gap-1.5 text-sm">
        {STATUS_ICONS[status] || STATUS_ICONS.unavailable}
        <span
          className={
            status === "granted"
              ? "text-green-600 dark:text-green-400"
              : status === "denied"
                ? "text-red-600 dark:text-red-400"
                : status === "prompt"
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-gray-400"
          }
        >
          {STATUS_LABELS[status] || status}
        </span>
      </span>
      {detail && (
        <span className="text-xs text-gray-400 hidden sm:inline">{detail}</span>
      )}
    </div>
  );
}

function BrowserGuide({ guide }) {
  return (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
      <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
        <Monitor className="w-4 h-4" />
        {guide.name} — Enable permissions
      </h4>
      <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700 dark:text-blue-300">
        {guide.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

function Troubleshooting() {
  const [open, setOpen] = useState(false);
  const tips = [
    "Close Zoom, Teams, Google Meet, or any app using your camera/microphone.",
    "Reconnect your webcam or microphone.",
    "Check your microphone mute switch or physical shutter.",
    "Restart your browser if devices are not detected.",
    "Ensure browser permissions for this site are set to Allow.",
    "Try a different USB port for your webcam.",
    "Update your camera/microphone drivers.",
  ];

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        aria-expanded={open}
      >
        <HelpCircle className="w-4 h-4" />
        Troubleshooting tips
        {open ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 pl-6 list-disc text-sm text-gray-600 dark:text-gray-400">
          {tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeviceSelector({ label, devices, selected, onChange, icon }) {
  if (devices.length <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
        {icon} {label}:
      </span>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        aria-label={`Select ${label}`}
      >
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `${label} ${devices.indexOf(d) + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
}

function AudioLevelBar({ level }) {
  const bars = 8;
  const activeBars = Math.round(level * bars);
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`Microphone level: ${Math.round(level * 100)}%`}
    >
      <Volume2 className="w-4 h-4 text-gray-400" />
      <div className="flex gap-0.5 h-4 items-end">
        {Array.from({ length: bars }, (_, i) => (
          <div
            key={i}
            className={`w-1.5 rounded-t-sm transition-all duration-75 ${
              i < activeBars
                ? level > 0.6
                  ? "bg-green-500"
                  : level > 0.3
                    ? "bg-yellow-500"
                    : "bg-gray-300 dark:bg-gray-600"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
            style={{ height: `${((i + 1) / bars) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function DeviceSetupModal({
  permission,
  onJoin,
  onContinueWithout,
}) {
  const videoRef = useRef(null);

  const {
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
    setError,
  } = permission;

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleEnable = async () => {
    setError(null);
    await requestMedia();
  };

  const handleRetry = async () => {
    await retry();
  };

  const handleJoin = () => {
    if (stream) {
      onJoin(stream);
    }
  };

  const handleContinueWithout = (mode) => {
    if (onContinueWithout) {
      onContinueWithout(mode);
    } else {
      onJoin(null);
    }
  };

  const blocked = isCameraBlocked || isMicBlocked;
  const allGranted = isCameraGranted && isMicGranted;
  const hasDevices = !cameraMissing || !micMissing;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-100 dark:from-slate-950 dark:via-slate-900 dark:to-purple-950/20 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            🎥 Ready to join?
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Set up your camera and microphone before entering the meeting.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Status Checks */}
          <div className="space-y-2">
            <StatusRow
              icon={<Camera className="w-4 h-4 text-indigo-500" />}
              label="Camera"
              status={cameraMissing ? "unavailable" : cameraStatus}
              detail={
                cameras.length > 0 ? `${cameras.length} detected` : undefined
              }
            />
            <StatusRow
              icon={<Mic className="w-4 h-4 text-indigo-500" />}
              label="Microphone"
              status={micMissing ? "unavailable" : micStatus}
              detail={
                microphones.length > 0
                  ? `${microphones.length} detected`
                  : undefined
              }
            />
            <StatusRow
              icon={<Monitor className="w-4 h-4 text-indigo-500" />}
              label="Browser"
              status="granted"
              detail={browserGuide.name}
            />
          </div>

          {/* Permission Request / Retry */}
          {!checked && (
            <div className="text-center py-3">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-gray-400 mt-2">
                Checking permissions...
              </p>
            </div>
          )}

          {error && (
            <div
              className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300"
              role="alert"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {errorType === "blocked"
                      ? "Permission Blocked"
                      : errorType === "not-found"
                        ? "Device Not Found"
                        : errorType === "in-use"
                          ? "Device In Use"
                          : "Device Access Error"}
                  </p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Camera Preview & Audio Level */}
          {stream && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                {isCameraGranted ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                    Camera preview unavailable
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-2">
                    Audio Level
                  </p>
                  <AudioLevelBar level={audioLevel} />
                </div>

                {isCameraGranted && (
                  <DeviceSelector
                    label="Camera"
                    icon={<Camera className="w-3 h-3" />}
                    devices={cameras}
                    selected={selectedCamera}
                    onChange={switchCamera}
                  />
                )}
                {isMicGranted && (
                  <DeviceSelector
                    label="Microphone"
                    icon={<Mic className="w-3 h-3" />}
                    devices={microphones}
                    selected={selectedMicrophone}
                    onChange={switchMicrophone}
                  />
                )}
              </div>
            </div>
          )}

          {/* Browser blocked guide */}
          {blocked && <BrowserGuide guide={browserGuide} />}

          {/* Troubleshooting */}
          {hasDevices && <Troubleshooting />}
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2">
            {!allGranted && !blocked && checked && (
              <button
                onClick={handleEnable}
                disabled={loading}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-full font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Requesting...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Enable Camera & Microphone
                  </>
                )}
              </button>
            )}
            {allGranted && stream && (
              <button
                onClick={handleJoin}
                className="px-6 py-2.5 bg-green-600 text-white rounded-full font-medium text-sm hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Join Meeting
              </button>
            )}
            {blocked && (
              <button
                onClick={handleRetry}
                disabled={loading}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-full font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Device Check
              </button>
            )}
          </div>

          {!allGranted && (
            <div className="flex gap-2">
              {!isCameraGranted && isMicGranted && (
                <button
                  onClick={() => handleContinueWithout("mic-only")}
                  className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  Join with mic only
                </button>
              )}
              {isCameraGranted && !isMicGranted && (
                <button
                  onClick={() => handleContinueWithout("camera-only")}
                  className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  Join with camera only
                </button>
              )}
              {!isCameraGranted && !isMicGranted && stream === null && (
                <button
                  onClick={() => handleContinueWithout("observer")}
                  className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-dashed border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  Join as observer
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
