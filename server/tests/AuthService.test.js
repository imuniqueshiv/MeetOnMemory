import { jest } from "@jest/globals";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import transporter from "../config/nodeMailer.js";
import { AppError } from "../utils/errors.js";

// AuthService statically re-imports bcryptjs (and the other mocks above).
// Importing AuthService as a static sibling of those modules creates a Jest/Node
// ESM diamond that triggers "module is already linked". Load it only after the
// shared leaves are already linked/evaluated.
const { default: AuthService } = await import("../services/AuthService.js");

describe("AuthService", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(transporter, "sendMail").mockResolvedValue(true);
    jest.spyOn(jwt, "sign").mockReturnValue("mockJwtToken");
  });

  describe("register", () => {
    it("should successfully register a new user and return user and token", async () => {
      jest.spyOn(userModel, "findOne").mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });
      jest.spyOn(bcrypt, "hash").mockResolvedValue("hashedPassword123");
      jest.spyOn(userModel.prototype, "save").mockResolvedValue(true);

      const result = await AuthService.register({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      });

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: "test@example.com",
      });
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
      expect(userModel.prototype.save).toHaveBeenCalled();
      expect(jwt.sign).toHaveBeenCalled();
      expect(transporter.sendMail).toHaveBeenCalled();
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("token", "mockJwtToken");
    });

    it("should throw AppError if user already exists", async () => {
      jest.spyOn(userModel, "findOne").mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: "existingUserId" }),
        }),
      });

      await expect(
        AuthService.register({
          name: "Test User",
          email: "existing@example.com",
          password: "password123",
        }),
      ).rejects.toThrow(new AppError("User already exists", 400));
    });
  });

  describe("login", () => {
    it("should successfully login a user and return user and token", async () => {
      const mockUser = {
        _id: "mockUserId",
        email: "test@example.com",
        password: "hashedPassword123",
      };
      jest.spyOn(userModel, "findOne").mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser),
      });
      jest.spyOn(bcrypt, "compare").mockResolvedValue(true);

      const result = await AuthService.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: "test@example.com",
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "password123",
        "hashedPassword123",
      );
      expect(jwt.sign).toHaveBeenCalled();
      expect(result).toEqual({ user: mockUser, token: "mockJwtToken" });
    });

    it("should throw AppError if user is not found", async () => {
      jest.spyOn(userModel, "findOne").mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(
        AuthService.login({
          email: "nonexistent@example.com",
          password: "password123",
        }),
      ).rejects.toThrow(new AppError("Invalid Email", 400));
    });

    it("should throw AppError if password does not match", async () => {
      jest.spyOn(userModel, "findOne").mockReturnValue({
        lean: jest.fn().mockResolvedValue({ password: "hashedPassword123" }),
      });
      jest.spyOn(bcrypt, "compare").mockResolvedValue(false);

      await expect(
        AuthService.login({
          email: "test@example.com",
          password: "wrongPassword",
        }),
      ).rejects.toThrow(new AppError("Invalid Password", 400));
    });
  });

  describe("resetPassword", () => {
    it("should successfully reset password", async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      const mockUser = {
        email: "test@example.com",
        resetOtp: "123456",
        resetOtpExpireAt: Date.now() + 10000,
        save: mockSave,
      };
      jest.spyOn(userModel, "findOne").mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, "hash").mockResolvedValue("newHashedPassword123");

      await AuthService.resetPassword({
        email: "test@example.com",
        otp: "123456",
        newPassword: "newPassword123",
      });

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: "test@example.com",
      });
      expect(bcrypt.hash).toHaveBeenCalledWith("newPassword123", 10);
      expect(mockUser.password).toBe("newHashedPassword123");
      expect(mockUser.resetOtp).toBe("");
      expect(mockUser.resetOtpExpireAt).toBe(0);
      expect(mockSave).toHaveBeenCalled();
    });

    it("should throw AppError if user not found", async () => {
      jest.spyOn(userModel, "findOne").mockResolvedValue(null);

      await expect(
        AuthService.resetPassword({
          email: "nonexistent@example.com",
          otp: "123456",
          newPassword: "newPassword123",
        }),
      ).rejects.toThrow(new AppError("Invalid request or expired token", 400));
    });

    it("should throw AppError if OTP is invalid", async () => {
      jest.spyOn(userModel, "findOne").mockResolvedValue({
        email: "test@example.com",
        resetOtp: "123456",
        resetOtpExpireAt: Date.now() + 10000,
      });

      await expect(
        AuthService.resetPassword({
          email: "test@example.com",
          otp: "wrongOtp",
          newPassword: "newPassword123",
        }),
      ).rejects.toThrow(new AppError("Invalid OTP", 400));
    });

    it("should throw AppError if OTP is expired", async () => {
      jest.spyOn(userModel, "findOne").mockResolvedValue({
        email: "test@example.com",
        resetOtp: "123456",
        resetOtpExpireAt: Date.now() - 10000,
      });

      await expect(
        AuthService.resetPassword({
          email: "test@example.com",
          otp: "123456",
          newPassword: "newPassword123",
        }),
      ).rejects.toThrow(new AppError("OTP expired", 400));
    });
  });
});
