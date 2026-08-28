/**
 * Issue #1335 & #2030 — Client-side transcript E2EE (Web Crypto AES-GCM).
 *
 * Architecture (incremental):
 * - True "server never sees plaintext" is incompatible with AssemblyAI/Whisper/
 *   Gemini/Pinecone in this codebase. Encrypted meetings store ciphertext only;
 *   AI/search pipelines must skip them (see server helpers).
 * - Legacy meetings keep plaintext `transcript` and continue to work.
 * - Keys never leave the browser; they are managed by meetingKeyStore with
 *   secure export/import and passphrase-wrapped backup capabilities (Issue #2030).
 */

export const TRANSCRIPT_ENCRYPTION_VERSION = 1;
export const TRANSCRIPT_ENCRYPTION_ALG = "AES-GCM";
export const TRANSCRIPT_KEY_LENGTH_BITS = 256;
export const KEY_BUNDLE_MAGIC = "MOM_E2EE_KEY_BUNDLE_V1";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const bufferToBase64 = (buffer) => {
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const base64ToBytes = (base64) => {
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
  const raw = base64ToBytes(base64Key.trim());
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: TRANSCRIPT_ENCRYPTION_ALG, length: TRANSCRIPT_KEY_LENGTH_BITS },
    true,
    ["encrypt", "decrypt"],
  );
};

/**
 * Derive an AES-GCM wrapping key from a user passphrase using PBKDF2.
 */
export const derivePassphraseKey = async (passphrase, saltBytes) => {
  if (!passphrase || typeof passphrase !== "string" || passphrase.length < 6) {
    throw new Error("Passphrase must be at least 6 characters");
  }
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: TRANSCRIPT_ENCRYPTION_ALG, length: TRANSCRIPT_KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  );
};

/**
 * Export a meeting key wrapped with a passphrase into a portable encrypted bundle.
 */
export const exportEncryptedKeyBundle = async (
  meetingId,
  rawBase64Key,
  passphrase,
  metadata = {},
) => {
  if (!meetingId || !rawBase64Key) {
    throw new Error("Meeting ID and key are required for export");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await derivePassphraseKey(passphrase, salt);

  const payloadToEncrypt = JSON.stringify({
    meetingId: String(meetingId),
    rawKey: rawBase64Key,
    createdAt: new Date().toISOString(),
    metadata,
  });

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: TRANSCRIPT_ENCRYPTION_ALG, iv },
    wrappingKey,
    textEncoder.encode(payloadToEncrypt),
  );

  return {
    magic: KEY_BUNDLE_MAGIC,
    version: 1,
    meetingId: String(meetingId),
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    encryptedData: bufferToBase64(ciphertextBuffer),
    algorithm: "PBKDF2-SHA256+AES-GCM-256",
    exportedAt: new Date().toISOString(),
  };
};

/**
 * Import and decrypt a password-protected key bundle.
 */
export const importEncryptedKeyBundle = async (bundle, passphrase) => {
  if (!bundle || bundle.magic !== KEY_BUNDLE_MAGIC) {
    throw new Error("Invalid or unsupported MeetOnMemory key backup bundle");
  }
  if (!bundle.salt || !bundle.iv || !bundle.encryptedData) {
    throw new Error("Corrupted key backup bundle");
  }
  const salt = base64ToBytes(bundle.salt);
  const iv = base64ToBytes(bundle.iv);
  const encryptedBytes = base64ToBytes(bundle.encryptedData);

  const wrappingKey = await derivePassphraseKey(passphrase, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: TRANSCRIPT_ENCRYPTION_ALG, iv },
      wrappingKey,
      encryptedBytes,
    );
    const parsed = JSON.parse(textDecoder.decode(decryptedBuffer));
    if (!parsed.rawKey) {
      throw new Error("Key bundle contains no raw key");
    }
    return {
      meetingId: parsed.meetingId || bundle.meetingId,
      rawKey: parsed.rawKey,
      createdAt: parsed.createdAt,
      metadata: parsed.metadata || {},
    };
  } catch {
    throw new Error(
      "Failed to unlock key backup: incorrect passphrase or corrupted file.",
    );
  }
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
