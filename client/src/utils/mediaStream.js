/**
 * MediaStream helpers for meeting join / device-setup handoff (Issue #1210).
 */

/** True if the stream has at least one track still in the "live" state. */
export function hasLiveTracks(stream) {
  if (!stream || typeof stream.getTracks !== "function") return false;
  return stream.getTracks().some((track) => track.readyState === "live");
}

/**
 * Resolve the MediaStream used when joining a meeting.
 * Reuses a still-valid Device Setup stream; otherwise acquires only what is needed.
 *
 * @param {object} options
 * @param {MediaStream|null} [options.providedStream]
 * @param {"mic-only"|"camera-only"|"observer"|null} [options.mode]
 * @param {string} [options.videoDeviceId]
 * @param {string} [options.audioDeviceId]
 * @returns {Promise<MediaStream>}
 */
export async function resolveMeetingMediaStream({
  providedStream = null,
  mode = null,
  videoDeviceId = "",
  audioDeviceId = "",
} = {}) {
  if (hasLiveTracks(providedStream)) {
    return providedStream;
  }

  if (mode === "observer") {
    return new MediaStream();
  }

  const constraints = {};

  if (mode === "mic-only") {
    constraints.audio = audioDeviceId
      ? { deviceId: { exact: audioDeviceId } }
      : true;
  } else if (mode === "camera-only") {
    constraints.video = videoDeviceId
      ? { deviceId: { exact: videoDeviceId } }
      : true;
  } else {
    constraints.video = videoDeviceId
      ? { deviceId: { exact: videoDeviceId } }
      : true;
    constraints.audio = audioDeviceId
      ? { deviceId: { exact: audioDeviceId } }
      : true;
  }

  if (!constraints.video && !constraints.audio) {
    return new MediaStream();
  }

  return navigator.mediaDevices.getUserMedia(constraints);
}

/** Derive initial mic/camera UI state from an active stream. */
export function getTrackEnabledState(stream) {
  const audioTrack = stream?.getAudioTracks?.()[0];
  const videoTrack = stream?.getVideoTracks?.()[0];
  return {
    micOn: Boolean(
      audioTrack && audioTrack.enabled && audioTrack.readyState === "live",
    ),
    cameraOn: Boolean(
      videoTrack && videoTrack.enabled && videoTrack.readyState === "live",
    ),
  };
}
