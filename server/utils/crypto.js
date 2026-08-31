import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

/**
 * Resolve the key protecting Slack / GitHub / Notion tokens.
 *
 * Unlike the calendar paths, this one does **not** fail closed: a missing
 * TOKEN_ENCRYPTION_KEY falls back to the literal below, which is public in this
 * repository, so integration tokens are recoverable by anyone holding a copy of
 * the database. Nothing is logged when that happens. Set the variable in every
 * non-local environment.
 *
 * The value is hashed to 32 bytes here, so any length works — but
 * `calendarSyncService` uses the same variable as a raw AES-256-GCM key and
 * requires exactly 32 bytes.
 *
 * Key matrix and failure modes: docs/security-and-health.md#encryption-keys
 */
const getEncryptionKey = () => {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key && process.env.NODE_ENV !== "test") {
    throw new Error("TOKEN_ENCRYPTION_KEY is required but not set.");
  }
  const effectiveKey = key || "default_dev_token_encryption_key_32";
  // Always derive a 32-byte key via SHA-256 to prevent crashes
  return crypto.createHash("sha256").update(effectiveKey).digest();
};

/**
 * Encrypts a token using AES-256-GCM
 * @param {string} text Plaintext token
 * @returns {string} Colon-separated ciphertext iv:encrypted:authTag
 */
export const encryptToken = (text) => {
  if (!text) return "";
  // If the token is already encrypted, return it
  if (text.split(":").length === 3 && !text.startsWith("xoxb-")) {
    return text;
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
};

/**
 * Decrypts a token using AES-256-GCM
 * Supports plain-text fallback for legacy tokens (starts with xoxb-)
 * @param {string} encryptedData Encrypted token string
 * @returns {string} Decrypted token
 */
export const decryptToken = (encryptedData) => {
  if (!encryptedData) return "";
  // Check for legacy unencrypted tokens
  if (encryptedData.startsWith("xoxb-")) {
    return encryptedData;
  }
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    return encryptedData;
  }
  try {
    const [ivHex, encryptedText, authTagHex] = parts;
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Failed to decrypt Slack token:", err.message);
    return encryptedData;
  }
};
