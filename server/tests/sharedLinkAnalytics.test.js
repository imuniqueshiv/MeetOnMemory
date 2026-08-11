import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindByIdAndUpdate = vi.fn(() => Promise.resolve({}));
const mockFindOne = vi.fn();
const mockFind = vi.fn();

vi.mock("../models/sharedLinkModel.js", () => ({
  default: {
    findOne: (...args) => mockFindOne(...args),
    findByIdAndUpdate: (...args) => mockFindByIdAndUpdate(...args),
    find: (...args) => mockFind(...args),
  },
}));

vi.mock("../models/meetingModel.js", () => ({
  default: {
    findById: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue({
          _id: "meeting-1",
          title: "Standup",
        }),
      })),
    })),
  },
}));

vi.mock("../models/policyModel.js", () => ({
  default: {
    findById: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue({
          _id: "policy-1",
          name: "Security Policy",
          version: "1.0",
          fileUrl: "http://example.com/secret.pdf",
          summary: "This is secure",
        }),
      })),
    })),
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    genSalt: vi.fn(),
    hash: vi.fn(),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(() => "signed-token"),
    verify: vi.fn(),
  },
}));

import bcrypt from "bcryptjs";
import {
  getPublicResource,
  verifyPasscode,
  getActiveLinks,
} from "../controllers/sharedLinkController.js";

const mockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    cookies: {},
  };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload) => {
    res.body = payload;
    return res;
  });
  res.cookie = vi.fn((name, value) => {
    res.cookies[name] = value;
    return res;
  });
  return res;
};

describe("Shared link analytics (#723)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    mockFindByIdAndUpdate.mockReturnValue(Promise.resolve({}));
  });

  it("increments totalViews and sets lastAccessed on successful public access", async () => {
    mockFindOne.mockResolvedValue({
      _id: "link-1",
      hash: "abc123",
      active: true,
      passcode: null,
      resourceModel: "Meeting",
      resourceId: "meeting-1",
    });

    const req = { params: { hash: "abc123" }, cookies: {} };
    const res = mockRes();

    await getPublicResource(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Standup");
    // analytics must not leak to public payload
    expect(res.body.totalViews).toBeUndefined();

    await vi.waitFor(() => {
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith("link-1", {
        $inc: { totalViews: 1 },
        $set: { lastAccessed: expect.any(Date) },
      });
    });
  });

  it("does not record a view when passcode is required and missing", async () => {
    mockFindOne.mockResolvedValue({
      _id: "link-2",
      hash: "locked",
      active: true,
      passcode: "hashed",
      resourceModel: "Meeting",
      resourceId: "meeting-1",
    });

    const req = { params: { hash: "locked" }, cookies: {} };
    const res = mockRes();

    await getPublicResource(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.requiresPasscode).toBe(true);
    expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("increments failedPasscodeAttempts on incorrect passcode", async () => {
    mockFindOne.mockResolvedValue({
      _id: "link-3",
      hash: "secure",
      active: true,
      passcode: "hashed-pass",
      expirationDate: null,
      failedPasscodeAttempts: 0,
      passcodeLockUntil: null,
      organizationId: "org-1",
      resourceModel: "Meeting",
    });
    mockFindByIdAndUpdate.mockResolvedValue({
      _id: "link-3",
      failedPasscodeAttempts: 1,
    });
    bcrypt.compare.mockResolvedValue(false);

    const req = {
      params: { hash: "secure" },
      body: { passcode: "wrong" },
    };
    const res = mockRes();

    await verifyPasscode(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Incorrect passcode");
    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
      "link-3",
      { $inc: { failedPasscodeAttempts: 1 } },
      { new: true },
    );
  });

  it("rejects verification while locked without running bcrypt", async () => {
    mockFindOne.mockResolvedValue({
      _id: "link-locked",
      hash: "locked-hash",
      active: true,
      passcode: "hashed-pass",
      expirationDate: null,
      failedPasscodeAttempts: 5,
      passcodeLockUntil: new Date(Date.now() + 60_000),
    });

    const req = {
      params: { hash: "locked-hash" },
      body: { passcode: "anything" },
    };
    const res = mockRes();

    await verifyPasscode(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Incorrect passcode");
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(mockFindByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("clears expired lockout and resets counters on successful verify", async () => {
    mockFindOne.mockResolvedValue({
      _id: "link-expired-lock",
      hash: "expired-lock",
      active: true,
      passcode: "hashed-pass",
      expirationDate: null,
      failedPasscodeAttempts: 5,
      passcodeLockUntil: new Date(Date.now() - 1000),
      organizationId: "org-1",
    });
    mockFindByIdAndUpdate.mockResolvedValue({});
    bcrypt.compare.mockResolvedValue(true);

    const req = {
      params: { hash: "expired-lock" },
      body: { passcode: "correct" },
    };
    const res = mockRes();

    await verifyPasscode(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith("link-expired-lock", {
      $set: {
        failedPasscodeAttempts: 0,
        passcodeLockUntil: null,
      },
    });
  });

  it("includes analytics only for users with edit permission", async () => {
    mockFind.mockResolvedValue([
      {
        _id: "link-4",
        hash: "h1",
        expirationDate: null,
        passcode: "x",
        active: true,
        createdAt: new Date("2024-01-01"),
        totalViews: 5,
        lastAccessed: new Date("2024-02-01"),
        failedPasscodeAttempts: 2,
      },
    ]);

    const memberReq = {
      params: { resourceType: "Meeting", resourceId: "m1" },
      user: { organization: "org-1", role: "member" },
    };
    const memberRes = mockRes();
    await getActiveLinks(memberReq, memberRes);
    expect(memberRes.body.links[0]).toMatchObject({
      totalViews: 5,
      failedPasscodeAttempts: 2,
    });
    expect(memberRes.body.links[0].lastAccessed).toBeTruthy();

    const viewerReq = {
      params: { resourceType: "Meeting", resourceId: "m1" },
      user: { organization: "org-1", role: "viewer" },
    };
    const viewerRes = mockRes();
    await getActiveLinks(viewerReq, viewerRes);
    expect(viewerRes.body.links[0].totalViews).toBeUndefined();
    expect(viewerRes.body.links[0].failedPasscodeAttempts).toBeUndefined();
    expect(viewerRes.body.links[0].hash).toBe("h1");
  });

  it("restricts public meeting resource response", async () => {
    mockFindOne.mockResolvedValue({
      _id: "link-meeting",
      hash: "m123",
      active: true,
      passcode: null,
      resourceModel: "Meeting",
      resourceId: "meeting-1",
    });

    const req = { params: { hash: "m123" }, cookies: {} };
    const res = mockRes();

    await getPublicResource(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("Standup");
    expect(res.body.data.transcript).toBeUndefined();
    expect(res.body.data.aiNotes).toBeUndefined();
    expect(res.body.data.meetingType).toBeUndefined();
  });

  it("restricts public policy resource response", async () => {
    mockFindOne.mockResolvedValue({
      _id: "link-policy",
      hash: "p123",
      active: true,
      passcode: null,
      resourceModel: "Policy",
      resourceId: "policy-1",
    });

    const req = { params: { hash: "p123" }, cookies: {} };
    const res = mockRes();

    await getPublicResource(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Security Policy");
    expect(res.body.data.summary).toBe("This is secure");
    expect(res.body.data.fileUrl).toBeUndefined();
    expect(res.body.data.isDraft).toBeUndefined();
  });
});
