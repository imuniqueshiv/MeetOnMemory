/**
 * Issue #1335 — server transcript encryption helper tests.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  isE2eeEnabled,
  isEncryptedTranscriptPayload,
  normalizeEncryptedTranscriptPayload,
  isMeetingTranscriptEncrypted,
  meetingSupportsServerAi,
} from "../utils/transcriptEncryption.js";

describe("transcriptEncryption helpers (#1335)", () => {
  const original = process.env.E2EE_ENABLED;

  afterEach(() => {
    process.env.E2EE_ENABLED = original;
  });

  it("reads E2EE_ENABLED feature flag", () => {
    process.env.E2EE_ENABLED = "true";
    expect(isE2eeEnabled()).toBe(true);
    process.env.E2EE_ENABLED = "false";
    expect(isE2eeEnabled()).toBe(false);
  });

  it("detects encrypted payload shapes", () => {
    expect(
      isEncryptedTranscriptPayload({
        ciphertext: "abc",
        iv: "def",
      }),
    ).toBe(true);
    expect(isEncryptedTranscriptPayload("plaintext")).toBe(false);
    expect(isEncryptedTranscriptPayload(null)).toBe(false);
  });

  it("normalizes valid encrypted payloads", () => {
    const result = normalizeEncryptedTranscriptPayload({
      ciphertext: "cipher",
      iv: "ivvalue",
      encryptionVersion: 1,
      algorithm: "AES-GCM",
    });
    expect(result.ok).toBe(true);
    expect(result.payload.ciphertext).toBe("cipher");
    expect(result.payload.iv).toBe("ivvalue");
  });

  it("rejects malformed encrypted payloads", () => {
    expect(normalizeEncryptedTranscriptPayload({}).ok).toBe(false);
    expect(normalizeEncryptedTranscriptPayload({ ciphertext: "x" }).ok).toBe(
      false,
    );
  });

  it("identifies encrypted meetings and blocks server AI", () => {
    const encryptedMeeting = {
      isTranscriptEncrypted: true,
      encryptedTranscript: { ciphertext: "c", iv: "i" },
      transcript: "",
    };
    expect(isMeetingTranscriptEncrypted(encryptedMeeting)).toBe(true);
    expect(meetingSupportsServerAi(encryptedMeeting)).toBe(false);

    const legacy = { transcript: "hello", isTranscriptEncrypted: false };
    expect(isMeetingTranscriptEncrypted(legacy)).toBe(false);
    expect(meetingSupportsServerAi(legacy)).toBe(true);
  });

  describe("isOrgE2eeEnforcedForMeeting", () => {
    it("returns false if meeting has no organization", async () => {
      const { isOrgE2eeEnforcedForMeeting } =
        await import("../utils/transcriptEncryption.js");
      const res = await isOrgE2eeEnforcedForMeeting({ title: "No Org" });
      expect(res).toBe(false);
    });

    it("returns false if organization does not enforce E2EE", async () => {
      const { isOrgE2eeEnforcedForMeeting } =
        await import("../utils/transcriptEncryption.js");
      const meeting = {
        organization: {
          e2eeSettings: {
            enabled: true,
            enforceOrgWide: false,
          },
        },
      };
      const res = await isOrgE2eeEnforcedForMeeting(meeting);
      expect(res).toBe(false);
    });

    it("returns true if organization enforces E2EE", async () => {
      const { isOrgE2eeEnforcedForMeeting } =
        await import("../utils/transcriptEncryption.js");
      const meeting = {
        organization: {
          e2eeSettings: {
            enabled: true,
            enforceOrgWide: true,
          },
        },
      };
      const res = await isOrgE2eeEnforcedForMeeting(meeting);
      expect(res).toBe(true);
    });
  });
});
