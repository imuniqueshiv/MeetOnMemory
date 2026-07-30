import { jest } from "@jest/globals";

jest.unstable_mockModule("@clerk/express", () => ({
  verifyToken: jest.fn(),
}));

jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    verify: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/userModel.js", () => ({
  default: {
    findById: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ _id: "mongo-id" }),
    })),
  },
}));

jest.unstable_mockModule("../services/authLinkingService.js", () => ({
  findUserByClerkId: jest
    .fn()
    .mockResolvedValue({ _id: "clerk-linked-mongo-id" }),
}));

describe("userAuth Middleware Dual Auth", () => {
  let userAuth;
  let verifyTokenMock;
  let jwtVerifyMock;

  beforeAll(async () => {
    const clerk = await import("@clerk/express");
    verifyTokenMock = clerk.verifyToken;

    const jwt = await import("jsonwebtoken");
    jwtVerifyMock = jwt.default.verify;

    const authModule = await import("../middleware/userAuth.js");
    userAuth = authModule.default;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should authenticate using legacy JWT when AUTH_PROVIDER is legacy", async () => {
    process.env.AUTH_PROVIDER = "legacy";
    process.env.JWT_SECRET = "secret";

    const req = { header: () => "Bearer legacy-token" };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    jwtVerifyMock.mockReturnValue({ id: "mongo-id" });

    await userAuth(req, res, next);

    expect(jwtVerifyMock).toHaveBeenCalledWith("legacy-token", "secret");
    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("should authenticate using Clerk when AUTH_PROVIDER is clerk", async () => {
    process.env.AUTH_PROVIDER = "clerk";
    process.env.CLERK_SECRET_KEY = "clerk-secret";

    const req = { header: () => "Bearer clerk-token" };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    verifyTokenMock.mockResolvedValue({ sub: "user_2xyz" });

    await userAuth(req, res, next);

    expect(verifyTokenMock).toHaveBeenCalledWith("clerk-token", {
      secretKey: "clerk-secret",
    });
    expect(jwtVerifyMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("should fallback to legacy JWT when AUTH_PROVIDER is dual and clerk fails", async () => {
    process.env.AUTH_PROVIDER = "dual";

    const req = { header: () => "Bearer dual-token" };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    verifyTokenMock.mockRejectedValue(new Error("Invalid clerk token"));
    jwtVerifyMock.mockReturnValue({ id: "mongo-id" });

    await userAuth(req, res, next);

    expect(verifyTokenMock).toHaveBeenCalled();
    expect(jwtVerifyMock).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
