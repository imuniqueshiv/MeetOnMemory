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
    findById: vi.fn(),
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
  getActiveLinksFixed,
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

    await vi.waitFor(() => {
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith("link-3", {
        $inc: { failedPasscodeAttempts: 1 },
      });
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
    await getActiveLinksFixed(memberReq, memberRes);
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
    await getActiveLinksFixed(viewerReq, viewerRes);
    expect(viewerRes.body.links[0].totalViews).toBeUndefined();
    expect(viewerRes.body.links[0].failedPasscodeAttempts).toBeUndefined();
    expect(viewerRes.body.links[0].hash).toBe("h1");
  });
});
