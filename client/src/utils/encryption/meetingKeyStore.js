/**
 * Browser-local meeting encryption key store (Issue #1335 & #2030).
 * Keys never leave the client; they are scoped per meeting id.
 * Provides key lifecycle helpers: export, import, enumeration, backup packaging,
 * and key transfer URL generator/parser.
 */

const STORAGE_PREFIX = "meetonmemory:e2ee:meeting:";
const BACKUP_META_PREFIX = "meetonmemory:e2ee:meta:";

const storageAvailable = () => {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
};

export const meetingKeyStorageKey = (meetingId) =>
  `${STORAGE_PREFIX}${String(meetingId)}`;

export const saveMeetingKey = (meetingId, base64Key, meta = {}) => {
  if (!meetingId || !base64Key || !storageAvailable()) return false;
  const keyStr = String(base64Key).trim();
  localStorage.setItem(meetingKeyStorageKey(meetingId), keyStr);
  try {
    const metaRecord = {
      updatedAt: new Date().toISOString(),
      ...meta,
    };
    localStorage.setItem(
      `${BACKUP_META_PREFIX}${String(meetingId)}`,
      JSON.stringify(metaRecord),
    );
  } catch {
    // metadata is best-effort
  }
  return true;
};

export const loadMeetingKey = (meetingId) => {
  if (!meetingId || !storageAvailable()) return null;
  const val = localStorage.getItem(meetingKeyStorageKey(meetingId));
  return val ? val.trim() : null;
};

export const clearMeetingKey = (meetingId) => {
  if (!meetingId || !storageAvailable()) return;
  localStorage.removeItem(meetingKeyStorageKey(meetingId));
  try {
    localStorage.removeItem(`${BACKUP_META_PREFIX}${String(meetingId)}`);
  } catch {
    // best-effort
  }
};

export const hasMeetingKey = (meetingId) => {
  return Boolean(loadMeetingKey(meetingId));
};

/**
 * List all stored meeting IDs that have client-side encryption keys.
 */
export const listStoredMeetingKeyIds = () => {
  if (!storageAvailable()) return [];
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keys.push(key.replace(STORAGE_PREFIX, ""));
      }
    }
  } catch {
    // fallback
  }
  return keys;
};

/**
 * Export a shareable formatted key package for an authorized participant.
 */
export const createShareableKeyPayload = (
  meetingId,
  rawBase64Key,
  meetingTitle = "",
) => {
  if (!meetingId || !rawBase64Key) {
    throw new Error("Meeting ID and key are required");
  }
  return JSON.stringify(
    {
      app: "MeetOnMemory",
      type: "E2EE_MEETING_KEY",
      version: 1,
      meetingId: String(meetingId),
      meetingTitle: meetingTitle || `Meeting ${meetingId}`,
      key: String(rawBase64Key).trim(),
      generatedAt: new Date().toISOString(),
      instructions:
        "Import this payload in MeetOnMemory Transcript Viewer to decrypt end-to-end encrypted notes.",
    },
    null,
    2,
  );
};

/**
 * Parse and validate an imported shareable payload or raw key string.
 */
export const parseImportedKeyInput = (input, expectedMeetingId = null) => {
  if (!input || typeof input !== "string") {
    throw new Error("Import data cannot be empty");
  }
  const trimmed = input.trim();

  // Try JSON payload first
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === "E2EE_MEETING_KEY" && parsed.key) {
        if (
          expectedMeetingId &&
          parsed.meetingId &&
          String(parsed.meetingId) !== String(expectedMeetingId)
        ) {
          throw new Error(
            `Key belongs to meeting "${parsed.meetingId}", not "${expectedMeetingId}".`,
          );
        }
        return {
          meetingId: parsed.meetingId,
          key: parsed.key,
          meetingTitle: parsed.meetingTitle,
          isBundle: false,
        };
      }
      if (parsed.magic === "MOM_E2EE_KEY_BUNDLE_V1") {
        if (
          expectedMeetingId &&
          parsed.meetingId &&
          String(parsed.meetingId) !== String(expectedMeetingId)
        ) {
          throw new Error(
            `Backup bundle belongs to meeting "${parsed.meetingId}", not "${expectedMeetingId}".`,
          );
        }
        return {
          meetingId: parsed.meetingId,
          bundle: parsed,
          isBundle: true,
        };
      }
    } catch (e) {
      if (e.message?.includes("belongs to meeting")) throw e;
      // Fall through to test as raw base64 key
    }
  }

  // Raw base64 key format (usually 44 chars for 256-bit AES key)
  if (/^[A-Za-z0-9+/=_-]{30,80}$/.test(trimmed)) {
    return {
      meetingId: expectedMeetingId,
      key: trimmed,
      isBundle: false,
    };
  }

  throw new Error(
    "Unrecognized key format. Paste raw key base64 string or encrypted JSON payload.",
  );
};
