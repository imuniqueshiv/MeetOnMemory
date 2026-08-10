/**
 * cryptoUtils.js
 * 
 * Utility functions for client-side End-to-End Encryption (E2EE)
 * using the WebCrypto API.
 */

// Generate a 256-bit AES-GCM key from a password using PBKDF2
export const deriveKeyFromPassword = async (password, saltString = "MeetOnMemorySalt") => {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const salt = enc.encode(saltString);

  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  return key;
};

// Store key in sessionStorage as JWK
export const saveKeyToSession = async (key) => {
  const jwk = await window.crypto.subtle.exportKey("jwk", key);
  sessionStorage.setItem("mom_e2ee_key", JSON.stringify(jwk));
};

// Retrieve key from sessionStorage
export const getKeyFromSession = async () => {
  const jwkString = sessionStorage.getItem("mom_e2ee_key");
  if (!jwkString) return null;
  
  try {
    const jwk = JSON.parse(jwkString);
    return await window.crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  } catch (err) {
    console.error("Failed to restore key from session", err);
    return null;
  }
};

// Encrypt a plaintext string using a CryptoKey
export const encryptText = async (plaintext, key) => {
  if (!plaintext) return plaintext;
  
  const enc = new TextEncoder();
  // 12 bytes IV is standard for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    enc.encode(plaintext)
  );

  // Convert IV + Ciphertext to Base64 to store/transmit
  const ciphertextBytes = new Uint8Array(ciphertextBuffer);
  const combined = new Uint8Array(iv.length + ciphertextBytes.length);
  combined.set(iv, 0);
  combined.set(ciphertextBytes, iv.length);

  return btoa(String.fromCharCode.apply(null, combined));
};

// Decrypt a Base64 ciphertext string using a CryptoKey
export const decryptText = async (base64Ciphertext, key) => {
  if (!base64Ciphertext) return base64Ciphertext;
  
  try {
    const binaryStr = atob(base64Ciphertext);
    const combined = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      combined[i] = binaryStr.charCodeAt(i);
    }

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (error) {
    console.error("Decryption failed. Incorrect key or corrupted data.", error);
    throw new Error("Decryption failed. Please check your encryption password.");
  }
};

// Helper: check if text appears to be our base64 encrypted format
export const isEncrypted = (text) => {
  if (!text || typeof text !== 'string') return false;
  // A rough heuristic: if it's base64 and > 16 bytes when decoded (since IV is 12 bytes and auth tag is 16 bytes, total > 28 bytes)
  // and doesn't contain spaces (typical base64). 
  // We can just rely on try/catch during decryption, but this helps UI decisions.
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  return base64Regex.test(text.trim()) && text.length > 20;
};
