import { describe, expect, it } from "vitest";
import {
  canManageMeetingDigest,
  isDigestDeliveryDisabledMessage,
} from "../digestAccess";

describe("canManageMeetingDigest (#1990)", () => {
  const meeting = {
    _id: "m-1",
    uploadedBy: "user-owner",
    organization: "org-a",
  };

  it("allows the meeting uploader", () => {
    expect(
      canManageMeetingDigest({
        meeting,
        dbUserId: "user-owner",
        userData: { role: "member", organization: "org-a" },
      }),
    ).toBe(true);
  });

  it("allows an org admin or owner", () => {
    expect(
      canManageMeetingDigest({
        meeting,
        dbUserId: "admin-1",
        userData: { _id: "admin-1", role: "admin", organization: "org-a" },
      }),
    ).toBe(true);
  });

  it("denies a member who does not own the meeting", () => {
    expect(
      canManageMeetingDigest({
        meeting,
        dbUserId: "member-9",
        userData: { _id: "member-9", role: "member", organization: "org-a" },
      }),
    ).toBe(false);
  });

  it("denies an admin from another organization", () => {
    expect(
      canManageMeetingDigest({
        meeting,
        dbUserId: "admin-b",
        userData: { role: "admin", organization: "org-b" },
      }),
    ).toBe(false);
  });
});

describe("isDigestDeliveryDisabledMessage (#1990)", () => {
  it("detects preference opt-out copy", () => {
    expect(
      isDigestDeliveryDisabledMessage(
        "All participants with emails have opted out of digests.",
      ),
    ).toBe(true);
  });

  it("does not treat a generic resend failure as a preference skip", () => {
    expect(
      isDigestDeliveryDisabledMessage("Failed to resend email digest"),
    ).toBe(false);
  });
});
