/**
 * Feature flag for client-side transcript E2EE (Issue #1335, #2030, #2263).
 * Evaluates organization-level e2eeSettings first, then falls back to VITE_E2EE_ENABLED.
 */
export const isE2eeEnabled = (organizationOrSettings) => {
  try {
    if (organizationOrSettings) {
      const e2ee =
        organizationOrSettings.e2eeSettings || organizationOrSettings;
      if (typeof e2ee?.enabled === "boolean") {
        return e2ee.enabled;
      }
    }
    const value =
      typeof import.meta !== "undefined" && import.meta.env
        ? import.meta.env.VITE_E2EE_ENABLED
        : undefined;
    return value === true || value === "true" || value === "1";
  } catch {
    return false;
  }
};

/**
 * Returns detailed effective E2EE status for an organization (Issue #2263).
 */
export const getEffectiveE2eeStatus = (organizationOrSettings) => {
  const e2ee = organizationOrSettings?.e2eeSettings || organizationOrSettings;
  if (typeof e2ee?.enabled === "boolean") {
    return {
      enabled: e2ee.enabled,
      source: "organization",
      enforceOrgWide: Boolean(e2ee.enforceOrgWide),
      updatedAt: e2ee.updatedAt || null,
    };
  }

  const envEnabled = isE2eeEnabled();
  return {
    enabled: envEnabled,
    source: envEnabled ? "env" : "disabled",
    enforceOrgWide: false,
    updatedAt: null,
  };
};

/**
 * Validates whether the current browser environment supports E2EE cryptography (Issue #2263).
 */
export const checkClientE2eeSupport = async () => {
  const hasWebCrypto =
    typeof window !== "undefined" && Boolean(window.crypto?.subtle);
  let hasAesGcm = false;
  let hasLocalStorage = false;

  try {
    if (hasWebCrypto) {
      const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );
      hasAesGcm = Boolean(key);
    }
  } catch {
    hasAesGcm = false;
  }

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const testKey = "__e2ee_probe__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      hasLocalStorage = true;
    }
  } catch {
    hasLocalStorage = false;
  }

  return {
    supported: Boolean(hasWebCrypto && hasAesGcm && hasLocalStorage),
    hasWebCrypto,
    hasAesGcm,
    hasLocalStorage,
  };
};

export {
  generateKey,
  exportKey,
  importKey,
  encryptTranscript,
  decryptTranscript,
  isEncryptedTranscriptPayload,
  derivePassphraseKey,
  exportEncryptedKeyBundle,
  importEncryptedKeyBundle,
  TRANSCRIPT_ENCRYPTION_VERSION,
  TRANSCRIPT_ENCRYPTION_ALG,
  KEY_BUNDLE_MAGIC,
} from "./transcriptCrypto.js";

export {
  saveMeetingKey,
  loadMeetingKey,
  clearMeetingKey,
  hasMeetingKey,
  listStoredMeetingKeyIds,
  createShareableKeyPayload,
  parseImportedKeyInput,
  meetingKeyStorageKey,
} from "./meetingKeyStore.js";

export {
  exportMeetingKeyBundle,
  importMeetingKeyBundle,
  isMeetingKeyBundle,
  serializeMeetingKeyBundle,
  parseMeetingKeyBundle,
  meetingKeyBundleFilename,
  MEETING_KEY_BUNDLE_VERSION,
  MEETING_KEY_BUNDLE_TYPE,
  MEETING_KEY_FILE_EXTENSION,
} from "./meetingKeyExport.js";
