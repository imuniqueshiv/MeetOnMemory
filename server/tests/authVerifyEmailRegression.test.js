import { jest } from "@jest/globals";

/**
 * Regression for Issue #604:
 * userAuth attaches req.user, but verification handlers previously read
 * req.userId (always undefined), breaking authenticated email verification.
 */
jest.unstable_mockModule("../services/calendarService.js", () => ({
  getGoogleAuthUrl: jest.fn(),
}));

jest.unstable_mockModule("../services/AuthService.js", () => ({
  default: {
    sendVerifyOtp: jest.fn(),
    verifyEmail: jest.fn(),
  },
}));

const AuthService = (await import("../services/AuthService.js")).default;
const { sendVerifyOtp, verifyEmail } =
  await import("../controllers/authControllers.js");

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Email verification auth identity (#604)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sendVerifyOtp uses req.user.id set by userAuth (not req.userId)", async () => {
    AuthService.sendVerifyOtp.mockResolvedValue(undefined);

    // Mimic userAuth: only req.user is populated — req.userId is absent.
    const req = { user: { id: "user-abc-123" } };
    const res = mockRes();

    await sendVerifyOtp(req, res);

    expect(AuthService.sendVerifyOtp).toHaveBeenCalledWith("user-abc-123");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Verification OTP sent on email",
      }),
    );
  });

  it("verifyEmail uses req.user.id set by userAuth (not req.userId)", async () => {
    AuthService.verifyEmail.mockResolvedValue(undefined);

    const req = {
      user: { id: "user-abc-123" },
      body: { otp: "654321" },
    };
    const res = mockRes();

    await verifyEmail(req, res);

    expect(AuthService.verifyEmail).toHaveBeenCalledWith({
      userId: "user-abc-123",
      otp: "654321",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Email verified successfully!",
      }),
    );
  });

  it("verifyEmail returns Missing details when otp is absent", async () => {
    const req = {
      user: { id: "user-abc-123" },
      body: {},
    };
    const res = mockRes();

    await verifyEmail(req, res);

    expect(AuthService.verifyEmail).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Missing details",
      }),
    );
  });
});
