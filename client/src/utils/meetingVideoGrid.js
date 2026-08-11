/**
 * Meeting room video grid layout helpers (Issue #907).
 *
 * Pure layout utilities — no WebRTC / media side effects.
 * Column density scales with participant count; Tailwind breakpoints
 * tighten the layout on mobile and tablet.
 */

/**
 * @param {number} participantCount Total tiles (local + remote).
 * @returns {string} Tailwind grid column classes.
 */
export function getMeetingVideoGridClass(participantCount) {
  const count = Math.max(1, Number(participantCount) || 1);

  if (count === 1) {
    return "grid-cols-1 max-w-4xl w-full mx-auto";
  }
  if (count === 2) {
    return "grid-cols-1 sm:grid-cols-2 max-w-5xl w-full mx-auto";
  }
  if (count <= 4) {
    return "grid-cols-1 sm:grid-cols-2 w-full";
  }
  if (count <= 6) {
    return "grid-cols-2 md:grid-cols-3 w-full";
  }
  if (count <= 9) {
    return "grid-cols-2 sm:grid-cols-3 w-full";
  }
  // 10+
  return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 w-full";
}

/** Shared tile chrome for local and remote participant videos. */
export const MEETING_VIDEO_TILE_CLASS =
  "relative bg-black rounded-xl sm:rounded-2xl overflow-hidden shadow-lg border border-gray-800 w-full min-w-0 min-h-0 aspect-video";
