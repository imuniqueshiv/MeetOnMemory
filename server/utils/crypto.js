import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

const getEncryptionKey = () => {
  const key =
    process.env.TOKEN_ENCRYPTION_KEY || "default_dev_token_encryption_key_32";
  // Always derive a 32-byte key via SHA-256 to prevent crashes
  return crypto.createHash("sha256").update(key).digest();
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
