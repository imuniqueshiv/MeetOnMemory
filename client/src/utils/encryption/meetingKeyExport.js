/**
 * Issue #2030 — portable meeting-key export / import.
 *
 * The per-meeting AES-GCM key (see meetingKeyStore) never leaves the browser, so
 * a transcript encrypted on one device is unreadable on another until the key is
 * moved across. Handing the raw key around in the clear would defeat E2EE, so we
 * wrap it in a *passphrase-protected* bundle: PBKDF2(passphrase) derives an
 * AES-GCM wrapping key that encrypts the meeting key. The bundle is safe to send
 * over email/chat or save as a file — it is useless without the passphrase, which
 * is shared out-of-band.
 *
 * Bundle shape (JSON):
 *   { v, type, meetingId, kdf:{name,hash,iterations,salt}, iv, ct }
 */

export const MEETING_KEY_BUNDLE_VERSION = 1;
export const MEETING_KEY_BUNDLE_TYPE = "meetonmemory.e2ee.meeting-key";
export const MEETING_KEY_FILE_EXTENSION = ".momkey";

const PBKDF2_ITERATIONS = 210000;
const PBKDF2_HASH = "SHA-256";
const SALT_BYTES = 16;
const IV_BYTES = 12;
const WRAP_ALG = "AES-GCM";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bufferToBase64 = (buffer) => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const base64ToBytes = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** Derive an AES-GCM wrapping key from a passphrase + salt via PBKDF2. */
const deriveWrappingKey = async (passphrase, saltBytes) => {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    baseKey,
    { name: WRAP_ALG, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

/**
 * Wrap a base64 meeting key into a passphrase-protected, shareable bundle.
 * @param {string} base64Key - the raw meeting key (from loadMeetingKey/exportKey)
 * @param {string} passphrase - protects the bundle; shared out-of-band
 * @param {string} meetingId
 */
export const exportMeetingKeyBundle = async (
  base64Key,
  passphrase,
  meetingId,
) => {
  if (!base64Key || typeof base64Key !== "string") {
    throw new Error("A meeting key is required to export.");
  }
  if (!passphrase || passphrase.length < 8) {
    throw new Error("Passphrase must be at least 8 characters.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const wrappingKey = await deriveWrappingKey(passphrase, salt);

  const ctBuffer = await crypto.subtle.encrypt(
    { name: WRAP_ALG, iv },
    wrappingKey,
    textEncoder.encode(base64Key),
  );

  return {
    v: MEETING_KEY_BUNDLE_VERSION,
    type: MEETING_KEY_BUNDLE_TYPE,
    meetingId: meetingId ? String(meetingId) : null,
    kdf: {
      name: "PBKDF2",
      hash: PBKDF2_HASH,
      iterations: PBKDF2_ITERATIONS,
      salt: bufferToBase64(salt),
    },
    iv: bufferToBase64(iv),
    ct: bufferToBase64(ctBuffer),
  };
};

/** True when `value` looks like a meeting-key bundle produced by export. */
export const isMeetingKeyBundle = (value) =>
  Boolean(
    value &&
    typeof value === "object" &&
    value.type === MEETING_KEY_BUNDLE_TYPE &&
    value.kdf &&
    typeof value.kdf.salt === "string" &&
    typeof value.iv === "string" &&
    typeof value.ct === "string",
  );

/**
 * Unwrap a bundle back into { meetingId, base64Key } using the passphrase.
 * Throws a friendly error on a wrong passphrase or tampered bundle.
 */
export const importMeetingKeyBundle = async (bundle, passphrase) => {
  if (!isMeetingKeyBundle(bundle)) {
    throw new Error("This file is not a valid meeting-key bundle.");
  }
  if (!passphrase) {
    throw new Error("Enter the passphrase used when the key was exported.");
  }

  const salt = base64ToBytes(bundle.kdf.salt);
  const iv = base64ToBytes(bundle.iv);
  const ct = base64ToBytes(bundle.ct);
  const wrappingKey = await deriveWrappingKey(passphrase, salt);

  let base64Key;
  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: WRAP_ALG, iv },
      wrappingKey,
      ct,
    );
    base64Key = textDecoder.decode(plainBuffer);
  } catch {
    throw new Error("Wrong passphrase, or the key file has been modified.");
  }

  return { meetingId: bundle.meetingId, base64Key };
};

/** Serialize a bundle to a downloadable JSON string. */
export const serializeMeetingKeyBundle = (bundle) =>
  JSON.stringify(bundle, null, 2);

/** Parse a bundle file's text back into an object (throws on invalid JSON/shape). */
export const parseMeetingKeyBundle = (text) => {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!isMeetingKeyBundle(parsed)) {
    throw new Error("This file is not a valid meeting-key bundle.");
  }
  return parsed;
};

/** Suggested filename for an exported bundle. */
export const meetingKeyBundleFilename = (meetingId) =>
  `meeting-${meetingId ? String(meetingId).slice(-8) : "key"}${MEETING_KEY_FILE_EXTENSION}`;
