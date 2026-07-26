import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomInt } from "node:crypto";
import userModel from "../models/userModel.js";
import transporter from "../config/nodeMailer.js";
import {
  EMAIL_VERIFY_TEMPLATE,
  PASSWORD_RESET_TEMPLATE,
} from "../config/emailTemplates.js";
import { AppError, NotFoundError } from "../utils/errors.js";

const normalizeEmail = (email) => String(email).trim().toLowerCase();

class AuthService {
  static async register({ name, email, password }) {
    const cleanEmail = normalizeEmail(email);
    const existingUser = await userModel
      .findOne({ email: cleanEmail })
      .select("_id")
      .lean();
    if (existingUser) {
      throw new AppError("User already exists", 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new userModel({
      name,
      email: cleanEmail,
      password: hashedPassword,
    });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    transporter
      .sendMail({
        from: process.env.SENDER_EMAIL,
        to: cleanEmail,
        subject: "Welcome to MeetOnMemory!",
        text: `Welcome to MeetOnMemory, ${name}! Your account has been successfully created.`,
      })
      .catch((err) => {
        console.error(`Background email transmission failed [Register]:`, err);
      });

    return { user, token };
  }

  static async login({ email, password }) {
    const cleanEmail = normalizeEmail(email);
    const user = await userModel.findOne({ email: cleanEmail }).lean();
    if (!user) {
      throw new AppError("Invalid Email", 400);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError("Invalid Password", 400);
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return { user, token };
  }

  static async sendVerifyOtp(userId) {
    const user = await userModel.findById(userId);

    if (!user) {
      throw new AppError("Authentication failed", 400);
    }
    if (user.isAccountVerified) {
      throw new AppError("Account already verified", 400);
    }

    const otp = randomInt(100000, 1000000).toString();
    user.verifyOtp = otp;
    user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Account Verification OTP",
      html: EMAIL_VERIFY_TEMPLATE.replace("{{otp}}", otp).replace(
        "{{email}}",
        user.email,
      ),
    });
  }

  static async verifyEmail({ userId, otp }) {
    const user = await userModel.findById(userId);
    if (!user) {
      throw new AppError("Verification session invalid", 400);
    }
    if (user.verifyOtp === "" || user.verifyOtp !== otp) {
      throw new AppError("Invalid OTP", 400);
    }
    if (user.verifyOtpExpireAt < Date.now()) {
      throw new AppError("OTP expired", 400);
    }

    user.isAccountVerified = true;
    user.verifyOtp = "";
    user.verifyOtpExpireAt = 0;
    await user.save();
  }

  static async sendResetOtp({ email }) {
    const cleanEmail = normalizeEmail(email);
    const user = await userModel.findOne({ email: cleanEmail });

    if (!user) {
      return; // Return silently if user not found for security
    }

    const otp = randomInt(100000, 1000000).toString();
    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000;
    await user.save();

    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Password Reset OTP",
      html: PASSWORD_RESET_TEMPLATE.replace("{{otp}}", otp).replace(
        "{{email}}",
        user.email,
      ),
    });
  }

  static async resetPassword({ email, otp, newPassword }) {
    const cleanEmail = normalizeEmail(email);
    const user = await userModel.findOne({ email: cleanEmail });

    if (!user) {
      throw new AppError("Invalid request or expired token", 400);
    }
    if (user.resetOtp === "" || user.resetOtp !== otp) {
      throw new AppError("Invalid OTP", 400);
    }
    if (user.resetOtpExpireAt < Date.now()) {
      throw new AppError("OTP expired", 400);
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = "";
    user.resetOtpExpireAt = 0;
    await user.save();
  }

  static async getUserData(userId) {
    const user = await userModel
      .findById(userId)
      .populate("organization", "name")
      .lean();

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user;
  }

  static async googleCalendarCallback({ code, token }) {
    // Deferred: calendarService pulls googleapis; keep it out of AuthService's
    // eager ESM link graph (Jest VM linker diamond with shared deps like bcrypt).
    const { getGoogleTokens } = await import("./calendarService.js");
    const tokens = await getGoogleTokens(code);

    if (!token) {
      throw new AppError("Not authenticated", 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const user = await userModel.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    user.googleAccessToken = tokens.access_token;
    if (tokens.refresh_token) {
      user.googleRefreshToken = tokens.refresh_token;
    }
    user.calendarSyncEnabled = true;
    await user.save();
  }
}

export default AuthService;
