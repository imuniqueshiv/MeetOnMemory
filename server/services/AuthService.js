import userModel from "../models/userModel.js";
import { NotFoundError } from "../utils/errors.js";

/**
 * AuthService — post-cutover surface.
 * Identity (login/register/OTP/password reset) is owned by Clerk.
 * This service only loads Mongo user documents for the app.
 */
class AuthService {
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
}

export default AuthService;
