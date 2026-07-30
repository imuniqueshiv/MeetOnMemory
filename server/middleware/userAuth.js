import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import { getAuthProviderFlag } from "../utils/authUtils.js";
import { findUserByClerkId } from "../services/authLinkingService.js";
import { verifyToken } from "@clerk/express";

const userAuth = async (req, res, next) => {
  try {
    const authProvider = getAuthProviderFlag();
    const token =
      req.cookies?.token || req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token found. Please login first.",
      });
    }

    let user = null;

    // 1. Try Clerk Authentication (if dual or clerk)
    if (authProvider === "clerk" || authProvider === "dual") {
      try {
        const decodedClerk = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY,
        });

        if (decodedClerk && decodedClerk.sub) {
          user = await findUserByClerkId(decodedClerk.sub);
          if (!user && authProvider === "clerk") {
            return res.status(404).json({
              success: false,
              message: "User not found in database.",
            });
          }
        }
      } catch (_err) {
        if (authProvider === "clerk") {
          return res.status(401).json({
            success: false,
            message: "Invalid Clerk token.",
          });
        }
      }
    }

    // 2. Try Legacy JWT Authentication (if dual or legacy, and user not found yet)
    if (!user && (authProvider === "legacy" || authProvider === "dual")) {
      try {
        const decodedJwt = jwt.verify(token, process.env.JWT_SECRET);
        user = await userModel.findById(decodedJwt.id).select("-password");
        if (!user && authProvider === "legacy") {
          return res.status(404).json({
            success: false,
            message: "User not found or token invalid.",
          });
        }
      } catch (_err) {
        if (authProvider === "legacy") {
          return res.status(401).json({
            success: false,
            message: "Unauthorized or token expired. Please login again.",
          });
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed. Invalid token.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({
      success: false,
      message: "Unauthorized or token expired.",
    });
  }
};

export default userAuth;
