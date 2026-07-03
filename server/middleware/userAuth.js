import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

const userAuth = async (req, res, next) => {
  try {
    const token =
      req.cookies?.token ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token found. Please login first.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await userModel.findById(decoded.id).select("-password").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or token invalid.",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    return res.status(401).json({
      success: false,
      message: "Unauthorized or token expired. Please login again.",
    });
  }
};

export default userAuth;
