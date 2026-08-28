/**
 * Issue #2030 — passphrase-wrapped meeting-key export/import tests.
 * Uses Node's webcrypto so tests run without a browser.
 */

import { webcrypto } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { Buffer } from "buffer";

beforeAll(() => {
  if (!globalThis.crypto) globalThis.crypto = webcrypto;
  if (typeof globalThis.btoa !== "function") {
    globalThis.btoa = (str) => Buffer.from(str, "binary").toString("base64");
  }
  if (typeof globalThis.atob !== "function") {
    globalThis.atob = (str) => Buffer.from(str, "base64").toString("binary");
  }
});

const {
  exportMeetingKeyBundle,
  importMeetingKeyBundle,
  isMeetingKeyBundle,
  serializeMeetingKeyBundle,
  parseMeetingKeyBundle,
  meetingKeyBundleFilename,
  MEETING_KEY_BUNDLE_TYPE,
} = await import("../meetingKeyExport.js");
const {
  generateKey,
  exportKey,
  importKey,
  encryptTranscript,
  decryptTranscript,
} = await import("../transcriptCrypto.js");

const makeBase64Key = async () => exportKey(await generateKey());

describe("meetingKeyExport (Issue #2030)", () => {
  it("round-trips a key through export → import with the right passphrase", async () => {
    const base64Key = await makeBase64Key();
    const bundle = await exportMeetingKeyBundle(
      base64Key,
      "correct horse battery",
      "meeting-123",
    );
    expect(isMeetingKeyBundle(bundle)).toBe(true);
    expect(bundle.type).toBe(MEETING_KEY_BUNDLE_TYPE);
    // The wrapped key must NOT appear in the bundle in the clear.
    expect(JSON.stringify(bundle)).not.toContain(base64Key);

    const { base64Key: recovered, meetingId } = await importMeetingKeyBundle(
      bundle,
      "correct horse battery",
    );
    expect(recovered).toBe(base64Key);
    expect(meetingId).toBe("meeting-123");
  });

  it("a second device can decrypt the same transcript after importing the key", async () => {
    // Device A: encrypt a transcript with a fresh key, then export the key.
    const key = await generateKey();
    const base64Key = await exportKey(key);
    const payload = await encryptTranscript(
      "board meeting notes: ship it",
      key,
    );
    const bundle = await exportMeetingKeyBundle(
      base64Key,
      "team-passphrase-9",
      "m-9",
    );

    // Device B: import the bundle, rebuild the key, decrypt.
    const { base64Key: importedB64 } = await importMeetingKeyBundle(
      bundle,
      "team-passphrase-9",
    );
    const keyB = await importKey(importedB64);
    expect(await decryptTranscript(payload, keyB)).toBe(
      "board meeting notes: ship it",
    );
  });

  it("rejects a wrong passphrase", async () => {
    const bundle = await exportMeetingKeyBundle(
      await makeBase64Key(),
      "the-right-one",
      "m1",
    );
    await expect(
      importMeetingKeyBundle(bundle, "the-wrong-one"),
    ).rejects.toThrow(/passphrase/i);
  });

  it("rejects a tampered bundle", async () => {
    const bundle = await exportMeetingKeyBundle(
      await makeBase64Key(),
      "passphrase-xy",
      "m1",
    );
    const tampered = {
      ...bundle,
      ct:
        bundle.ct.slice(0, -4) +
        (bundle.ct.slice(-4) === "AAAA" ? "BBBB" : "AAAA"),
    };
    await expect(
      importMeetingKeyBundle(tampered, "passphrase-xy"),
    ).rejects.toThrow();
  });

  it("enforces a minimum passphrase length", async () => {
    await expect(
      exportMeetingKeyBundle(await makeBase64Key(), "short", "m1"),
    ).rejects.toThrow(/8 characters/i);
  });

  it("serializes and parses a bundle file; rejects non-bundle input", async () => {
    const bundle = await exportMeetingKeyBundle(
      await makeBase64Key(),
      "passphrase-xy",
      "m42",
    );
    const text = serializeMeetingKeyBundle(bundle);
    expect(parseMeetingKeyBundle(text)).toEqual(bundle);
    expect(() => parseMeetingKeyBundle("{}")).toThrow(
      /valid meeting-key bundle/i,
    );
    expect(() => parseMeetingKeyBundle("not json")).toThrow(/valid JSON/i);
  });

  it("suggests a filename scoped to the meeting", () => {
    expect(meetingKeyBundleFilename("abcdef1234567890")).toMatch(/\.momkey$/);
  });
});
