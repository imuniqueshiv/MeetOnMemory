import { useState, useCallback, useEffect, useRef } from "react";
import { CONSENT_VERSION } from "../components/meetings/ConsentModal.jsx";
import apiClient from "../services/apiClient.js";

/**
 * Recording Consent Hook — Issue #2247
 *
 * Manages consent state for recording, upload, and live room flows.
 * - Persists consent in localStorage to avoid repeated prompts within a session
 * - Optionally persists to the server for audit trail
 * - Provides hasConsent, showModal, consentTimestamp, consentVersion
 *
 * @param {Object} options
 * @param {string} options.meetingId — current meeting ID (if available)
 * @param {string} options.context — "record" | "upload" | "room"
 * @param {boolean} options.persistToServer — whether to POST consent to server (default: true)
 * @param {string} options.storageKey — custom localStorage key prefix
 */
const useRecordingConsent = ({
  meetingId = null,
  context = "record",
  persistToServer = true,
  storageKey = "meetonmemory_recording_consent",
} = {}) => {
  const [hasConsent, setHasConsent] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState(null);
  const [consentVersion, setConsentVersion] = useState(CONSENT_VERSION);
  const [isPersisting, setIsPersisting] = useState(false);

  const consentRecordRef = useRef(null);

  // Build the localStorage key scoped to context + optional meetingId
  const localStorageKey = meetingId
    ? `${storageKey}_${context}_${meetingId}`
    : `${storageKey}_${context}`;

  // Check existing consent on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(localStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          parsed.consentVersion === CONSENT_VERSION &&
          parsed.consentTimestamp
        ) {
          // Valid consent found in localStorage
          setHasConsent(true);
          setConsentTimestamp(parsed.consentTimestamp);
          setConsentVersion(parsed.consentVersion);
          consentRecordRef.current = parsed;
        }
      }
    } catch (err) {
      // Silently handle corrupted localStorage data
      console.warn("Failed to read consent from localStorage:", err);
      localStorage.removeItem(localStorageKey);
    }
  }, [localStorageKey]);

  /**
   * Record consent to localStorage and optionally to the server
   */
  const recordConsent = useCallback(
    async (userId = null) => {
      const timestamp = new Date().toISOString();
      const record = {
        consentVersion: CONSENT_VERSION,
        consentTimestamp: timestamp,
        context,
        meetingId,
        userId,
        method: "explicit_click",
        userAgent: navigator.userAgent,
      };

      // Persist to localStorage
      try {
        localStorage.setItem(localStorageKey, JSON.stringify(record));
      } catch (err) {
        console.warn("Failed to persist consent to localStorage:", err);
      }

      // Update state
      setHasConsent(true);
      setConsentTimestamp(timestamp);
      setConsentVersion(CONSENT_VERSION);
      consentRecordRef.current = record;

      // Persist to server for audit trail
      if (persistToServer) {
        try {
          setIsPersisting(true);
          await apiClient.post("/api/consent/record", {
            meetingId: meetingId || undefined,
            context,
            consentVersion: CONSENT_VERSION,
            consentTimestamp: timestamp,
          });
        } catch (err) {
          // Non-critical: localStorage consent is still valid for the session
          console.warn("Failed to persist consent to server:", err);
        } finally {
          setIsPersisting(false);
        }
      }

      return record;
    },
    [localStorageKey, context, meetingId, persistToServer],
  );

  /**
   * Request consent — shows modal if not already consented
   * Returns a promise that resolves with true/false
   */
  const requestConsent = useCallback(() => {
    if (hasConsent) {
      return Promise.resolve(true);
    }
    setShowModal(true);
    return new Promise((resolve) => {
      consentRecordRef.current = { _resolve: resolve };
    });
  }, [hasConsent]);

  /**
   * Handle user accepting consent in the modal
   */
  const handleAccept = useCallback(
    async (userId = null) => {
      setShowModal(false);
      await recordConsent(userId);
      const resolver = consentRecordRef.current?._resolve;
      if (typeof resolver === "function") {
        resolver(true);
      }
    },
    [recordConsent],
  );

  /**
   * Handle user declining consent in the modal
   */
  const handleDecline = useCallback(() => {
    setShowModal(false);
    const resolver = consentRecordRef.current?._resolve;
    if (typeof resolver === "function") {
      resolver(false);
    }
  }, []);

  /**
   * Revoke consent (for testing / user withdrawal)
   */
  const revokeConsent = useCallback(() => {
    try {
      localStorage.removeItem(localStorageKey);
    } catch (err) {
      // ignore
    }
    setHasConsent(false);
    setConsentTimestamp(null);
    consentRecordRef.current = null;
  }, [localStorageKey]);

  return {
    // State
    hasConsent,
    showModal,
    consentTimestamp,
    consentVersion,
    isPersisting,

    // Actions
    requestConsent,
    recordConsent,
    handleAccept,
    handleDecline,
    revokeConsent,

    // Consent record for inspection
    consentRecord: consentRecordRef.current,
  };
};

export default useRecordingConsent;
