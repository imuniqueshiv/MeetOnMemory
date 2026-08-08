import { describe, it, expect, beforeEach, vi } from "vitest";
import { provisionOrLinkClerkUser } from "../services/authLinkingService.js";
import userModel from "../models/userModel.js";

vi.mock("../models/userModel.js", () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

describe("Clerk User Provisioning Concurrency & Race Condition (#1115)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles duplicate key error (E11000) during concurrent user creation gracefully", async () => {
    // 1. Initial lookup by clerkUserId returns null
    // 2. Lookup by email returns null
    // 3. userModel.create throws Mongo E11000 duplicate key error
    // 4. Retry lookup finds existing user created by parallel request

    const existingUser = {
      _id: "mongo_parallel_123",
      clerkUserId: "user_race_1115",
      email: "concurrent@example.com",
      name: "Concurrent User",
      toObject: vi.fn().mockReturnValue({
        _id: "mongo_parallel_123",
        clerkUserId: "user_race_1115",
        email: "concurrent@example.com",
        name: "Concurrent User",
        password: "CLERK_AUTH_dummy",
      }),
    };

    userModel.findOne
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue(existingUser) });

    const dupKeyError = new Error(
      "E11000 duplicate key error collection: users index: clerkUserId_1 dup key",
    );
    dupKeyError.code = 11000;
    dupKeyError.name = "MongoServerError";

    userModel.create.mockRejectedValueOnce(dupKeyError);

    const result = await provisionOrLinkClerkUser({
      clerkUserId: "user_race_1115",
      email: "concurrent@example.com",
      name: "Concurrent User",
    });

    expect(result._id).toBe("mongo_parallel_123");
    expect(result.clerkUserId).toBe("user_race_1115");
    expect(result.password).toBeUndefined();
    expect(userModel.create).toHaveBeenCalledTimes(1);
    expect(userModel.findOne).toHaveBeenCalledTimes(3);
  });
});
