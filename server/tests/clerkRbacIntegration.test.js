import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  provisionOrLinkClerkUser,
  findUserByClerkId,
  linkUserToClerkId,
} from "../services/authLinkingService.js";
import userModel from "../models/userModel.js";

vi.mock("../models/userModel.js", () => ({
  default: {
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
  },
}));

describe("Clerk User Provisioning & MongoDB RBAC Integration (#801)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds user by Clerk ID", async () => {
    const mockUser = { _id: "mongo123", clerkUserId: "user_clerk_1" };
    userModel.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUser),
    });

    const result = await findUserByClerkId("user_clerk_1");
    expect(result).toEqual(mockUser);
    expect(userModel.findOne).toHaveBeenCalledWith({
      clerkUserId: "user_clerk_1",
    });
  });

  it("links existing user to Clerk ID", async () => {
    const mockUser = { _id: "mongo123", clerkUserId: "user_clerk_1" };
    userModel.findByIdAndUpdate.mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUser),
    });

    const result = await linkUserToClerkId("mongo123", "user_clerk_1");
    expect(result).toEqual(mockUser);
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "mongo123",
      { $set: { clerkUserId: "user_clerk_1" } },
      { new: true },
    );
  });

  it("provisions a new MongoDB user idempotently when no account exists", async () => {
    userModel.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });

    const mockCreated = {
      _id: "mongo999",
      clerkUserId: "user_clerk_new",
      email: "newuser@example.com",
      name: "New User",
      role: null,
      organization: null,
      toObject: vi.fn().mockReturnValue({
        _id: "mongo999",
        clerkUserId: "user_clerk_new",
        email: "newuser@example.com",
        name: "New User",
        password: "secret_dummy_password",
      }),
    };

    userModel.create.mockResolvedValue(mockCreated);

    const user = await provisionOrLinkClerkUser({
      clerkUserId: "user_clerk_new",
      email: "newuser@example.com",
      name: "New User",
    });

    expect(user._id).toBe("mongo999");
    expect(user.clerkUserId).toBe("user_clerk_new");
    expect(user.password).toBeUndefined(); // password stripped
  });

  it("links legacy user by email when authenticating with Clerk for the first time", async () => {
    const existingLegacyUser = {
      _id: "mongoLegacy",
      email: "legacy@example.com",
      name: "Legacy User",
      clerkUserId: null,
      save: vi.fn().mockResolvedValue(true),
    };

    // First query for clerkUserId returns null, second query for email returns legacy user
    userModel.findOne
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({
        select: vi.fn().mockResolvedValue(existingLegacyUser),
      });

    const user = await provisionOrLinkClerkUser({
      clerkUserId: "user_clerk_legacy",
      email: "legacy@example.com",
    });

    expect(user._id).toBe("mongoLegacy");
    expect(existingLegacyUser.clerkUserId).toBe("user_clerk_legacy");
    expect(existingLegacyUser.save).toHaveBeenCalled();
  });
});
