import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

const userAuth = async (req, res, next) => {
  try {
    // ✅ 1. Try to get token from cookies or header
    const token =
      req.cookies?.token || req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token found. Please login first.",
      });
    }

    // ✅ 2. Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ 3. Fetch full user document
    const user = await userModel.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or token invalid.",
      });
    }

    // ✅ 4. Attach full user to request
    req.user = user;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Unauthorized or token expired. Please login again.",
    });
  }
};

export default userAuth;
