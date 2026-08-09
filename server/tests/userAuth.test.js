import { jest } from "@jest/globals";

jest.unstable_mockModule("@clerk/express", () => ({
  verifyToken: jest.fn(),
}));

jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    verify: jest.fn(),
    sign: jest.fn(),
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
  provisionOrLinkClerkUser: jest
    .fn()
    .mockResolvedValue({ _id: "provisioned-mongo-id" }),
}));

const loggerInfo = jest.fn();
const loggerError = jest.fn();

jest.unstable_mockModule("../utils/logger.js", () => ({
  default: {
    info: loggerInfo,
    warn: jest.fn(),
    error: loggerError,
  },
}));

describe("userAuth Middleware Clerk Auth", () => {
  let userAuth;
  let verifyTokenMock;
  let jwtVerifyMock;
  let findUserByClerkId;
  let provisionOrLinkClerkUser;

  beforeAll(async () => {
    const clerk = await import("@clerk/express");
    verifyTokenMock = clerk.verifyToken;

    const jwt = await import("jsonwebtoken");
    jwtVerifyMock = jwt.default.verify;

    const linking = await import("../services/authLinkingService.js");
    findUserByClerkId = linking.findUserByClerkId;
    provisionOrLinkClerkUser = linking.provisionOrLinkClerkUser;

    const authModule = await import("../middleware/userAuth.js");
    userAuth = authModule.default;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should authenticate using Clerk test JWT (CLERK_TEST_AUTH=jwt) with sub claim", async () => {
    process.env.AUTH_PROVIDER = "clerk";
    process.env.NODE_ENV = "test";
    process.env.CLERK_TEST_AUTH = "jwt";
    process.env.JWT_SECRET = "secret";

    const req = { header: () => "Bearer clerk-test-token" };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    jwtVerifyMock.mockReturnValue({
      sub: "user_2xyz",
      email: "clerk@example.com",
    });
    findUserByClerkId.mockResolvedValue({ _id: "clerk-linked-mongo-id" });

    await userAuth(req, res, next);

    expect(jwtVerifyMock).toHaveBeenCalledWith("clerk-test-token", "secret");
    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(findUserByClerkId).toHaveBeenCalledWith("user_2xyz");
    expect(next).toHaveBeenCalled();
    expect(req.user._id).toBe("clerk-linked-mongo-id");
  });

  it("should authenticate using Clerk verifyToken when CLERK_TEST_AUTH is not jwt", async () => {
    process.env.AUTH_PROVIDER = "clerk";
    process.env.CLERK_SECRET_KEY = "clerk-secret";
    process.env.NODE_ENV = "development";
    delete process.env.CLERK_TEST_AUTH;

    const req = { header: () => "Bearer clerk-token" };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    verifyTokenMock.mockResolvedValue({ sub: "user_2xyz" });
    findUserByClerkId.mockResolvedValue({ _id: "clerk-linked-mongo-id" });

    await userAuth(req, res, next);

    expect(verifyTokenMock).toHaveBeenCalledWith("clerk-token", {
      secretKey: "clerk-secret",
    });
    expect(jwtVerifyMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("should provision a Mongo user when Clerk id is not linked yet", async () => {
    process.env.AUTH_PROVIDER = "clerk";
    process.env.NODE_ENV = "test";
    process.env.CLERK_TEST_AUTH = "jwt";
    process.env.JWT_SECRET = "secret";

    const req = { header: () => "Bearer new-clerk-token" };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    jwtVerifyMock.mockReturnValue({
      sub: "user_new",
      email: "new@example.com",
      name: "New User",
    });
    findUserByClerkId.mockResolvedValue(null);
    provisionOrLinkClerkUser.mockResolvedValue({ _id: "provisioned-mongo-id" });

    await userAuth(req, res, next);

    expect(provisionOrLinkClerkUser).toHaveBeenCalledWith({
      clerkUserId: "user_new",
      email: "new@example.com",
      name: "New User",
      profilePic: undefined,
    });
    expect(req.user._id).toBe("provisioned-mongo-id");
    expect(next).toHaveBeenCalled();
  });

  it("should reject requests with no Bearer token", async () => {
    const req = { header: () => undefined };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await userAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should reject Clerk test tokens missing sub", async () => {
    process.env.AUTH_PROVIDER = "clerk";
    process.env.NODE_ENV = "test";
    process.env.CLERK_TEST_AUTH = "jwt";
    process.env.JWT_SECRET = "secret";

    const req = { header: () => "Bearer bad-token" };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    jwtVerifyMock.mockReturnValue({ id: "mongo-id" });

    await userAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid Clerk token.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("userAuth sensitive log sanitization", () => {
  let userAuth;
  let sanitizeAuthRequestForLog;
  let jwtVerifyMock;
  let findUserByClerkId;

  beforeAll(async () => {
    const jwt = await import("jsonwebtoken");
    jwtVerifyMock = jwt.default.verify;

    const linking = await import("../services/authLinkingService.js");
    findUserByClerkId = linking.findUserByClerkId;

    const authModule = await import("../middleware/userAuth.js");
    userAuth = authModule.default;
    sanitizeAuthRequestForLog = authModule.sanitizeAuthRequestForLog;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("redacts Authorization headers and cookies from sanitized log context", () => {
    const req = {
      method: "GET",
      originalUrl: "/api/user/data",
      ip: "127.0.0.1",
      headers: {
        origin: "http://localhost:5173",
        authorization: "Bearer super-secret-token",
        cookie: "token=super-secret-cookie",
      },
      cookies: { token: "super-secret-cookie" },
      header: (name) =>
        name === "Authorization" ? "Bearer super-secret-token" : undefined,
    };

    const safe = sanitizeAuthRequestForLog(req);

    expect(safe).toEqual({
      method: "GET",
      url: "/api/user/data",
      ip: "127.0.0.1",
      origin: "http://localhost:5173",
      hasAuthorizationHeader: true,
    });
    expect(JSON.stringify(safe)).not.toMatch(/super-secret/i);
    expect(safe).not.toHaveProperty("hasAuthCookie");
    expect(safe).not.toHaveProperty("cookies");
    expect(safe).not.toHaveProperty("authorization");
    expect(safe).not.toHaveProperty("headers");
  });

  it("logs only sanitized metadata in non-production and never logs credentials", async () => {
    const previousEnv = process.env.NODE_ENV;
    const previousTestAuth = process.env.CLERK_TEST_AUTH;
    process.env.NODE_ENV = "development";
    process.env.AUTH_PROVIDER = "clerk";
    process.env.CLERK_TEST_AUTH = "jwt";
    process.env.JWT_SECRET = "secret";

    const secretToken = "super-secret-bearer-token";
    const req = {
      method: "POST",
      originalUrl: "/api/auth/protected",
      ip: "10.0.0.8",
      headers: {
        origin: "https://app.example.com",
        authorization: `Bearer ${secretToken}`,
      },
      cookies: { token: "super-secret-cookie-value" },
      header: (name) =>
        name === "Authorization" ? `Bearer ${secretToken}` : undefined,
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    jwtVerifyMock.mockReturnValue({ sub: "user_clerk_1" });
    findUserByClerkId.mockResolvedValue({ _id: "mongo-id" });

    await userAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(loggerInfo).toHaveBeenCalled();

    for (const call of loggerInfo.mock.calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain(secretToken);
      expect(serialized).not.toContain("super-secret-cookie-value");
      expect(serialized).not.toMatch(/Bearer\s+\S+/i);
    }

    const successCall = loggerInfo.mock.calls.find(
      ([message]) => message === "Auth middleware success",
    );
    expect(successCall).toBeTruthy();
    expect(successCall[1]).toMatchObject({
      method: "POST",
      url: "/api/auth/protected",
      ip: "10.0.0.8",
      origin: "https://app.example.com",
      hasAuthorizationHeader: true,
      userId: "mongo-id",
    });
    expect(successCall[1]).not.toHaveProperty("hasAuthCookie");

    process.env.NODE_ENV = previousEnv;
    process.env.CLERK_TEST_AUTH = previousTestAuth;
  });

  it("does not emit verbose auth info logs in production", async () => {
    const previousEnv = process.env.NODE_ENV;
    const previousTestAuth = process.env.CLERK_TEST_AUTH;
    process.env.NODE_ENV = "production";
    process.env.AUTH_PROVIDER = "clerk";
    process.env.CLERK_SECRET_KEY = "clerk-secret";
    delete process.env.CLERK_TEST_AUTH;

    const clerk = await import("@clerk/express");
    clerk.verifyToken.mockResolvedValue({ sub: "user_prod" });
    findUserByClerkId.mockResolvedValue({ _id: "mongo-id" });

    const req = {
      method: "GET",
      originalUrl: "/api/user/data",
      header: () => "Bearer prod-token",
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await userAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(loggerInfo).not.toHaveBeenCalled();

    process.env.NODE_ENV = previousEnv;
    process.env.CLERK_TEST_AUTH = previousTestAuth;
  });
});
