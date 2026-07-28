import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

const userAuth = async (req, res, next) => {
  try {
console.log("=================================");
    console.log("Origin:", req.headers.origin);
    console.log("Cookies present:", req.cookies?.token ? "YES" : "NO");
    console.log("Authorization header present:", req.headers.authorization ? "YES" : "NO");
    console.log("=================================");
    const token =
      req.cookies?.token || req.header("Authorization")?.replace("Bearer ", "");

    console.log("Token Found:", token ? "YES" : "NO");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token found. Please login first.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

console.log("Decoded JWT user id:", decoded?.id);
    const user = await userModel.findById(decoded.id).select("-password");

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
