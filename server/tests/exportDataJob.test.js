import { jest } from "@jest/globals";

// Mock the dependencies using unstable_mockModule for ESM
jest.unstable_mockModule("../models/userModel.js", () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    find: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/membershipModel.js", () => ({
  default: {
    find: jest.fn(),
  },
}));

jest.unstable_mockModule("../config/nodeMailer.js", () => ({
  default: {
    sendMail: jest.fn(),
  },
}));

jest.unstable_mockModule("../services/eventBus.js", () => ({
  default: {
    emit: jest.fn(),
  },
}));

jest.unstable_mockModule("jsonwebtoken", () => ({
  default: {
    sign: jest.fn(),
  },
}));

// Import dynamically after mocking
const userModel = (await import("../models/userModel.js")).default;
const {
  default: exportDataJob,
  sanitizeUserForExport,
  SENSITIVE_USER_FIELDS,
} = await import("../jobs/exportDataJob.js");

describe("exportDataJob & user export sanitization (#388)", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("sanitizeUserForExport", () => {
    it("should remove password, OTPs, tokens, and internal security metadata", () => {
      const dirtyUser = {
        _id: "user_123",
        name: "Jane Doe",
        email: "jane@example.com",
        password: "$2a$10$secretpasswordhash",
        verifyOtp: "123456",
        verifyOtpExpireAt: 1700000000000,
        resetOtp: "654321",
        resetOtpExpireAt: 1700000000000,
        resetPasswordToken: "tok_abc123",
        resetPasswordExpires: 1700000000000,
        otp: "999999",
        otpExpires: 1700000000000,
        googleAccessToken: "ya29.secrettoken",
        googleRefreshToken: "1//secretrefreshtoken",
        googleId: "google_123",
        __v: 0,
        role: "member",
        bio: "Hello world",
        profilePic: "https://example.com/pic.jpg",
      };

      const sanitized = sanitizeUserForExport(dirtyUser);

      expect(sanitized._id).toBe("user_123");
      expect(sanitized.name).toBe("Jane Doe");
      expect(sanitized.email).toBe("jane@example.com");
      expect(sanitized.role).toBe("member");
      expect(sanitized.bio).toBe("Hello world");
      expect(sanitized.profilePic).toBe("https://example.com/pic.jpg");

      for (const field of SENSITIVE_USER_FIELDS) {
        expect(sanitized[field]).toBeUndefined();
      }
    });

    it("should return null if user is null or undefined", () => {
      expect(sanitizeUserForExport(null)).toBeNull();
      expect(sanitizeUserForExport(undefined)).toBeNull();
    });
  });

  describe("exportDataJob handler", () => {
    it("should throw an error if the user is not found", async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      const mockJob = {
        data: { userId: "nonexistent_user", email: "test@test.com" },
      };

      await expect(exportDataJob(mockJob, null)).rejects.toThrow(
        "User not found",
      );
    });
  });
});
