/**
 * Issue #2263 — E2EE Feature-Flag server and organization enforcement tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isOrgE2eeEnabled,
  isOrgE2eeEnforced,
} from "../utils/transcriptEncryption.js";

describe("E2EE Feature Flag & Rollout Server Enforcement (#2263)", () => {
  const originalEnv = process.env.E2EE_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.E2EE_ENABLED;
  });

  afterEach(() => {
    process.env.E2EE_ENABLED = originalEnv;
  });

  describe("transcriptEncryption helpers", () => {
    it("evaluates organization e2eeSettings when present", () => {
      expect(isOrgE2eeEnabled({ e2eeSettings: { enabled: true } })).toBe(true);
      expect(isOrgE2eeEnabled({ e2eeSettings: { enabled: false } })).toBe(
        false,
      );
      expect(
        isOrgE2eeEnforced({
          e2eeSettings: { enabled: true, enforceOrgWide: true },
        }),
      ).toBe(true);
      expect(
        isOrgE2eeEnforced({
          e2eeSettings: { enabled: false, enforceOrgWide: true },
        }),
      ).toBe(false);
      expect(
        isOrgE2eeEnforced({
          e2eeSettings: { enabled: true, enforceOrgWide: false },
        }),
      ).toBe(false);
    });

    it("falls back to server env flag when organization settings are not set", () => {
      process.env.E2EE_ENABLED = "true";
      expect(isOrgE2eeEnabled(null)).toBe(true);

      process.env.E2EE_ENABLED = "false";
      expect(isOrgE2eeEnabled(null)).toBe(false);
    });
  });
});
