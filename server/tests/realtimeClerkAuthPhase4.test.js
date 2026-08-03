import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { authenticateSocket } from "../middleware/socketAuth.js";
import * as authLinkingService from "../services/authLinkingService.js";
import * as clerkExpress from "@clerk/express";

vi.mock("@clerk/express", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("../services/authLinkingService.js", () => ({
  findUserByClerkId: vi.fn(),
  provisionOrLinkClerkUser: vi.fn(),
}));

describe("Phase 4: Realtime Services & Third-Party Integration Clerk Auth (#890)", () => {
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummyOrgId = new mongoose.Types.ObjectId();
  let mockSocket;
  let nextFn;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = {
      handshake: { auth: {}, headers: {} },
      request: { headers: {} },
    };
    nextFn = vi.fn();
    delete process.env.AUTH_PROVIDER;
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.JWT_SECRET;
    // Ensure real Clerk verifyToken path (not CLERK_TEST_AUTH jwt stand-in)
    delete process.env.CLERK_TEST_AUTH;
  });

  it("authenticates socket connection via Clerk token when provider is clerk", async () => {
    process.env.AUTH_PROVIDER = "clerk";
    process.env.CLERK_SECRET_KEY = "mock_clerk_secret";
    mockSocket.handshake.auth.token = "valid_clerk_jwt";

    const mockClerkUser = {
      _id: dummyUserId,
      role: "admin",
      organization: dummyOrgId,
      email: "clerkuser@example.com",
    };

    clerkExpress.verifyToken.mockResolvedValue({ sub: "user_clerk_123" });
    authLinkingService.findUserByClerkId.mockResolvedValue(mockClerkUser);

    await authenticateSocket(mockSocket, nextFn);

    expect(clerkExpress.verifyToken).toHaveBeenCalledWith("valid_clerk_jwt", {
      secretKey: "mock_clerk_secret",
    });
    expect(authLinkingService.findUserByClerkId).toHaveBeenCalledWith(
      "user_clerk_123",
    );
    expect(mockSocket.userId).toBe(dummyUserId.toString());
    expect(mockSocket.userRole).toBe("admin");
    expect(mockSocket.userOrganization).toBe(dummyOrgId);
    expect(nextFn).toHaveBeenCalledWith();
  });

  it("provisions Clerk user on-the-fly when Clerk user doesn't exist in MongoDB yet", async () => {
    process.env.AUTH_PROVIDER = "clerk";
    process.env.CLERK_SECRET_KEY = "mock_clerk_secret";
    mockSocket.handshake.headers.authorization = "Bearer clerk_new_user_token";

    const newProvisionedUser = {
      _id: dummyUserId,
      role: "member",
      organization: dummyOrgId,
      email: "newclerk@example.com",
    };

    clerkExpress.verifyToken.mockResolvedValue({
      sub: "user_clerk_new",
      email: "newclerk@example.com",
      name: "New Clerk User",
    });
    authLinkingService.findUserByClerkId.mockResolvedValue(null);
    authLinkingService.provisionOrLinkClerkUser.mockResolvedValue(
      newProvisionedUser,
    );

    await authenticateSocket(mockSocket, nextFn);

    expect(authLinkingService.provisionOrLinkClerkUser).toHaveBeenCalledWith({
      clerkUserId: "user_clerk_new",
      email: "newclerk@example.com",
      name: "New Clerk User",
      profilePic: undefined,
    });
    expect(mockSocket.userId).toBe(dummyUserId.toString());
    expect(nextFn).toHaveBeenCalledWith();
  });

  it("rejects unauthorized socket connection when Clerk token is invalid", async () => {
    process.env.AUTH_PROVIDER = "clerk";
    process.env.CLERK_SECRET_KEY = "mock_clerk_secret";
    mockSocket.handshake.auth.token = "bad_clerk_jwt";

    clerkExpress.verifyToken.mockRejectedValue(
      new Error("Invalid Clerk token"),
    );

    await authenticateSocket(mockSocket, nextFn);

    expect(nextFn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Authentication error: Invalid Clerk token",
      }),
    );
  });

  it("rejects unauthorized socket connection gracefully when no token is provided", async () => {
    await authenticateSocket(mockSocket, nextFn);

    expect(nextFn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Authentication error: No token provided",
      }),
    );
  });
});
