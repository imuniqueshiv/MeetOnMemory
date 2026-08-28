/**
 * Issue #1335 & #2030 — Web Crypto AES-GCM transcript encryption tests.
 *
 * Uses Node's webcrypto when available so tests run without a browser.
 */

import { webcrypto } from "node:crypto";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { Buffer } from "buffer";

beforeAll(() => {
  if (!globalThis.crypto) {
    globalThis.crypto = webcrypto;
  }
  if (typeof globalThis.btoa !== "function") {
    globalThis.btoa = (str) => Buffer.from(str, "binary").toString("base64");
  }
  if (typeof globalThis.atob !== "function") {
    globalThis.atob = (str) => Buffer.from(str, "base64").toString("binary");
  }
});

// Mock browser localStorage for Node vitest environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStorage.get(k) ?? null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
  clear: () => mockStorage.clear(),
  get length() {
    return mockStorage.size;
  },
  key: (i) => Array.from(mockStorage.keys())[i] ?? null,
};

const {
  generateKey,
  exportKey,
  importKey,
  encryptTranscript,
  decryptTranscript,
  isEncryptedTranscriptPayload,
  exportEncryptedKeyBundle,
  importEncryptedKeyBundle,
  saveMeetingKey,
  loadMeetingKey,
  clearMeetingKey,
  hasMeetingKey,
  listStoredMeetingKeyIds,
  createShareableKeyPayload,
  parseImportedKeyInput,
} = await import("../index.js");

describe("transcriptCrypto & meetingKeyStore (Issue #1335 & #2030)", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("generates an AES-GCM key and round-trips export/import", async () => {
    const key = await generateKey();
    const exported = await exportKey(key);
    expect(typeof exported).toBe("string");
    expect(exported.length).toBeGreaterThan(10);

    const imported = await importKey(exported);
    expect(imported.type).toBe("secret");
  });

  it("encrypts and decrypts transcript plaintext", async () => {
    const key = await generateKey();
    const plaintext =
      "Alice: We should ship the encryption feature.\nBob: Agreed.";

    const payload = await encryptTranscript(plaintext, key);

    expect(payload.ciphertext).toBeTruthy();
    expect(payload.iv).toBeTruthy();
    expect(payload.algorithm).toBe("AES-GCM");
    expect(payload.encryptionVersion).toBe(1);
    expect(isEncryptedTranscriptPayload(payload)).toBe(true);

    const decrypted = await decryptTranscript(payload, key);
    expect(decrypted).toBe(plaintext);
  });

  it("uses a unique IV per encryption", async () => {
    const key = await generateKey();
    const a = await encryptTranscript("same text", key);
    const b = await encryptTranscript("same text", key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("rejects decryption with the wrong key", async () => {
    const keyA = await generateKey();
    const keyB = await generateKey();
    const payload = await encryptTranscript("secret meeting notes", keyA);

    await expect(decryptTranscript(payload, keyB)).rejects.toThrow(
      /wrong key|tampered/i,
    );
  });

  it("rejects tampered ciphertext", async () => {
    const key = await generateKey();
    const payload = await encryptTranscript("sensitive content", key);
    const tampered = {
      ...payload,
      ciphertext: `${payload.ciphertext.slice(0, -4)}AAAA`,
    };

    await expect(decryptTranscript(tampered, key)).rejects.toThrow();
  });

  it("rejects a modified IV", async () => {
    const key = await generateKey();
    const payload = await encryptTranscript("sensitive content", key);
    const badIv = btoa("xxxxxxxxxxxx"); // 12 bytes of 'x'
    const tampered = { ...payload, iv: badIv };

    await expect(decryptTranscript(tampered, key)).rejects.toThrow();
  });

  it("rejects malformed payloads", async () => {
    const key = await generateKey();
    await expect(decryptTranscript(null, key)).rejects.toThrow(/Invalid/);
    await expect(decryptTranscript({ ciphertext: "x" }, key)).rejects.toThrow(
      /missing/i,
    );
    await expect(encryptTranscript(123, key)).rejects.toThrow(/string/i);
  });

  it("detects encrypted vs legacy shapes", () => {
    expect(
      isEncryptedTranscriptPayload({
        ciphertext: "abc",
        iv: "def",
      }),
    ).toBe(true);
    expect(isEncryptedTranscriptPayload("plain text transcript")).toBe(false);
    expect(isEncryptedTranscriptPayload(null)).toBe(false);
    expect(isEncryptedTranscriptPayload({})).toBe(false);
  });

  it("exports and imports passphrase-encrypted key bundles (#2030)", async () => {
    const key = await generateKey();
    const rawKey = await exportKey(key);
    const meetingId = "meet_789123";
    const passphrase = "correct-horse-battery";

    const bundle = await exportEncryptedKeyBundle(
      meetingId,
      rawKey,
      passphrase,
      { title: "Sprint Planning" },
    );

    expect(bundle.magic).toBe("MOM_E2EE_KEY_BUNDLE_V1");
    expect(bundle.salt).toBeTruthy();
    expect(bundle.encryptedData).toBeTruthy();

    // Successful unlock with correct passphrase
    const unlocked = await importEncryptedKeyBundle(bundle, passphrase);
    expect(unlocked.rawKey).toBe(rawKey);
    expect(unlocked.meetingId).toBe(meetingId);
    expect(unlocked.metadata.title).toBe("Sprint Planning");

    // Rejection with wrong passphrase
    await expect(
      importEncryptedKeyBundle(bundle, "wrong-passphrase"),
    ).rejects.toThrow(/incorrect passphrase/i);
  });

  it("manages localStorage key persistence and listings (#2030)", () => {
    expect(hasMeetingKey("m1")).toBe(false);
    expect(loadMeetingKey("m1")).toBeNull();

    saveMeetingKey("m1", "base64-key-data-1");
    saveMeetingKey("m2", "base64-key-data-2");

    expect(hasMeetingKey("m1")).toBe(true);
    expect(loadMeetingKey("m1")).toBe("base64-key-data-1");
    expect(listStoredMeetingKeyIds()).toContain("m1");
    expect(listStoredMeetingKeyIds()).toContain("m2");

    clearMeetingKey("m1");
    expect(hasMeetingKey("m1")).toBe(false);
    expect(loadMeetingKey("m1")).toBeNull();
  });

  it("generates shareable JSON payload and parses valid input (#2030)", () => {
    const meetingId = "meet_456";
    const rawKey = "dGVzdC1rZXktYmFzZTY0LXN0cmluZw==";
    const payload = createShareableKeyPayload(meetingId, rawKey, "Design Sync");

    expect(payload).toContain("E2EE_MEETING_KEY");
    expect(payload).toContain(meetingId);

    // Parsing JSON payload
    const parsed = parseImportedKeyInput(payload, meetingId);
    expect(parsed.isBundle).toBe(false);
    expect(parsed.key).toBe(rawKey);

    // Mismatched meetingId detection
    expect(() =>
      parseImportedKeyInput(payload, "different_meeting_id"),
    ).toThrow(/belongs to meeting/i);

    // Parsing raw base64 string
    const parsedRaw = parseImportedKeyInput(rawKey, meetingId);
    expect(parsedRaw.key).toBe(rawKey);
  });
});
