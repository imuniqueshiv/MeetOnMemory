import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPost = vi.fn();
const mockGet = vi.fn();

vi.mock("../apiClient", () => ({
  default: {
    post: (...args) => mockPost(...args),
    get: (...args) => mockGet(...args),
  },
}));

import { authApi } from "../authApi";

describe("authApi email verification endpoint (#605)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ data: { success: true } });
  });

  it("verifyAccount posts to /api/auth/verify-email (matches backend route)", async () => {
    const payload = { otp: "123456" };

    await authApi.verifyAccount(payload);

    expect(mockPost).toHaveBeenCalledWith("/api/auth/verify-email", payload);
    expect(mockPost).not.toHaveBeenCalledWith(
      "/api/auth/verify-account",
      expect.anything(),
    );
  });
});
