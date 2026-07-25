import userModel from "../models/userModel.js";
import { dataExportQueue } from "../services/queueService.js";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const formatUserResponse = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    isAccountVerified: user.isAccountVerified,
    role: user.role,
    hasCompletedOnboarding: user.hasCompletedOnboarding,
    organization: user.organization,
    profilePic: user.profilePic || "",
    bio: user.bio || "",
    createdAt: user.createdAt,
  };
};

// @desc    Get user data
// @route   GET /api/user/get-user
// @access  Private
export const getUserData = async (req, res) => {
  try {
    // --- SAFETY CHECK ---
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    // Now this line is safe to run
    const user = await userModel
      .findById(req.user.id)
      .select("-password")
      .populate("organization", "name logo");

    if (user) {
      sendSuccess(res, { user: formatUserResponse(user) });
    } else {
      return sendError(res, 404, "User not found in database");
    }
  } catch (error) {
    console.error("Error in getUserData:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Update user profile
// @route   PUT /api/user/update
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const { name, profilePic, bio } = req.body;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    // Validation
    if (!name || name.trim() === "") {
      return sendError(res, 400, "Name is required.");
    }

    if (profilePic && profilePic.trim() !== "") {
      let parsed;
      try {
        parsed = new URL(profilePic.trim());
      } catch {
        return sendError(res, 400, "Profile picture must be a valid URL.");
      }
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return sendError(res, 400, "Image URL must use http or https.");
      }
    }

    const updatedUser = await userModel
      .findByIdAndUpdate(
        req.user.id,
        {
          $set: {
            name: name.trim(),
            profilePic: profilePic ? profilePic.trim() : "",
            bio: bio ? bio.trim() : "",
          },
        },
        { new: true },
      )
      .populate("organization", "name logo");

    if (!updatedUser) {
      return sendError(res, 404, "User not found.");
    }

    sendSuccess(
      res,
      { user: formatUserResponse(updatedUser) },
      "Profile updated successfully.",
    );
  } catch (error) {
    console.error("Error in updateUserProfile:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Request data export
// @route   POST /api/user/request-data-export
// @access  Private
export const requestDataExport = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const user = await userModel.findById(req.user.id);
    if (!user) {
      return sendError(res, 404, "User not found.");
    }

    if (dataExportQueue) {
      await dataExportQueue.add("export", {
        userId: user._id.toString(),
        email: user.email,
      });

      return sendSuccess(
        res,
        null,
        "Data export request accepted. You will receive an email when it is ready.",
        202,
      );
    } else {
      return sendError(
        res,
        503,
        "Background processing service is currently unavailable.",
      );
    }
  } catch (error) {
    console.error("Error in requestDataExport:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Download data export
// @route   GET /api/user/download-export/:token
// @access  Public (Token verification acts as auth)
export const downloadExport = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return sendError(res, 400, "No token provided.");
    }

    const jwtSecret = process.env.JWT_SECRET;

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (_err) {
      return sendError(res, 401, "Invalid or expired token.");
    }

    const { fileName } = decoded;
    if (!fileName) {
      return sendError(res, 400, "Invalid token payload.");
    }

    const exportDir = path.join(__dirname, "..", "uploads", "exports");
    const filePath = path.join(exportDir, fileName);

    if (!filePath.startsWith(exportDir)) {
      return sendError(res, 403, "Invalid file path.");
    }

    if (!fs.existsSync(filePath)) {
      return sendError(res, 404, "Export file not found or has been deleted.");
    }

    res.download(filePath, "data_export.zip", (err) => {
      if (err) {
        console.error("Error sending file:", err);
        // Don't send another response if headers are already sent
        if (!res.headersSent) {
          sendError(res, 500, "Error downloading file.");
        }
      }
    });
  } catch (error) {
    console.error("Error in downloadExport:", error);
    sendError(res, 500, "Server error");
  }
};
