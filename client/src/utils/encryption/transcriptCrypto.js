/**
 * Issue #1335 — Client-side transcript E2EE (Web Crypto AES-GCM).
 *
 * Architecture (incremental):
 * - True "server never sees plaintext" is incompatible with AssemblyAI/Whisper/
 *   Gemini/Pinecone in this codebase. Encrypted meetings store ciphertext only;
 *   AI/search pipelines must skip them (see server helpers).
 * - Legacy meetings keep plaintext `transcript` and continue to work.
 * - Keys never leave the browser; they are managed by meetingKeyStore.
 */

export const TRANSCRIPT_ENCRYPTION_VERSION = 1;
export const TRANSCRIPT_ENCRYPTION_ALG = "AES-GCM";
export const TRANSCRIPT_KEY_LENGTH_BITS = 256;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const base64ToBytes = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/**
 * Generate a new AES-GCM 256-bit CryptoKey (extractable for local key storage).
 */
export const generateKey = async () =>
  crypto.subtle.generateKey(
    { name: TRANSCRIPT_ENCRYPTION_ALG, length: TRANSCRIPT_KEY_LENGTH_BITS },
    true,
    ["encrypt", "decrypt"],
  );

/**
 * Export a CryptoKey as a base64 raw key string.
 */
export const exportKey = async (key) => {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bufferToBase64(raw);
};

/**
 * Import a base64 raw key string as an AES-GCM CryptoKey.
 */
export const importKey = async (base64Key) => {
  if (!base64Key || typeof base64Key !== "string") {
    throw new Error("Invalid encryption key");
  }
  const raw = base64ToBytes(base64Key);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: TRANSCRIPT_ENCRYPTION_ALG, length: TRANSCRIPT_KEY_LENGTH_BITS },
    true,
    ["encrypt", "decrypt"],
  );
};

/**
 * Encrypt plaintext transcript with AES-GCM.
 * @returns {{ ciphertext: string, iv: string, encryptionVersion: number, algorithm: string }}
 */
export const encryptTranscript = async (plaintext, key) => {
  if (typeof plaintext !== "string") {
    throw new Error("Transcript plaintext must be a string");
  }
  if (!key) {
    throw new Error("Encryption key is required");
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: TRANSCRIPT_ENCRYPTION_ALG, iv },
    key,
    textEncoder.encode(plaintext),
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    encryptionVersion: TRANSCRIPT_ENCRYPTION_VERSION,
    algorithm: TRANSCRIPT_ENCRYPTION_ALG,
  };
};

/**
 * Decrypt an encrypted transcript payload.
 * Rejects tampered ciphertext / wrong key via WebCrypto (throws).
 */
export const decryptTranscript = async (payload, key) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid encrypted transcript payload");
  }
  if (!payload.ciphertext || !payload.iv) {
    throw new Error("Encrypted transcript missing ciphertext or iv");
  }
  if (!key) {
    throw new Error("Decryption key is required");
  }

  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);

  try {
    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: TRANSCRIPT_ENCRYPTION_ALG, iv },
      key,
      ciphertext,
    );
    return textDecoder.decode(plaintextBuffer);
  } catch {
    throw new Error(
      "Failed to decrypt transcript (wrong key or tampered ciphertext)",
    );
  }
};

/**
 * Detect encrypted payload shape (server + client).
 */
export const isEncryptedTranscriptPayload = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    typeof value.ciphertext === "string" &&
    value.ciphertext.length > 0 &&
    typeof value.iv === "string" &&
    value.iv.length > 0
  );
};
