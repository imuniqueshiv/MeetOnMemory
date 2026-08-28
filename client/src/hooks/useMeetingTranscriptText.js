import { useCallback, useEffect, useState } from "react";
import {
  decryptTranscript,
  encryptTranscript,
  exportKey,
  generateKey,
  importKey,
  isE2eeEnabled,
  isEncryptedTranscriptPayload,
  loadMeetingKey,
  saveMeetingKey,
} from "../utils/encryption/index.js";
import apiClient from "../services/apiClient.js";

/**
 * Resolve displayable transcript text for a meeting (Issue #1335).
 * Handles legacy plaintext and encrypted payloads.
 */
export const useMeetingTranscriptText = (meeting, refreshToken = 0) => {
  const [plaintext, setPlaintext] = useState("");
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      setError(null);
      if (!meeting) {
        setPlaintext("");
        setIsEncrypted(false);
        return;
      }

      const encrypted = meeting.encryptedTranscript;
      const legacy = meeting.transcript || "";

      if (
        meeting.isTranscriptEncrypted ||
        isEncryptedTranscriptPayload(encrypted)
      ) {
        setIsEncrypted(true);
        setLoading(true);
        try {
          const stored = loadMeetingKey(meeting._id);
          if (!stored) {
            throw new Error(
              "Encryption key not found in this browser. Import the meeting key to decrypt.",
            );
          }
          const key = await importKey(stored);
          const text = await decryptTranscript(encrypted, key);
          if (!cancelled) setPlaintext(text);
        } catch (err) {
          if (!cancelled) {
            setPlaintext("");
            setError(err.message || "Failed to decrypt transcript");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      setIsEncrypted(false);
      setPlaintext(legacy);
      setLoading(false);
    };

    resolve();
    return () => {
      cancelled = true;
    };
    // refreshToken lets callers force a re-decrypt after importing a key
    // without refetching the meeting (Issue #2030).
  }, [meeting, refreshToken]);

  /**
   * Encrypt current plaintext (or provided text) and persist ciphertext to server.
   */
  const encryptAndStore = useCallback(
    async (text) => {
      if (!isE2eeEnabled()) {
        throw new Error("E2EE is not enabled (VITE_E2EE_ENABLED)");
      }
      if (!meeting?._id) {
        throw new Error("Meeting is required");
      }
      const source = typeof text === "string" ? text : plaintext;
      if (!source?.trim()) {
        throw new Error("No plaintext transcript to encrypt");
      }

      let key;
      const existing = loadMeetingKey(meeting._id);
      if (existing) {
        key = await importKey(existing);
      } else {
        key = await generateKey();
        saveMeetingKey(meeting._id, await exportKey(key));
      }

      const payload = await encryptTranscript(source, key);
      const res = await apiClient.post(
        `/api/meetings/${meeting._id}/transcript/encrypted`,
        payload,
      );
      return res.data;
    },
    [meeting, plaintext],
  );

  return {
    plaintext,
    isEncrypted,
    error,
    loading,
    e2eeEnabled: isE2eeEnabled(),
    encryptAndStore,
  };
};

export default useMeetingTranscriptText;
