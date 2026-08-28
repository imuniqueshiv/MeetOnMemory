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
    dashboardPreferences: user.dashboardPreferences || null,
    emailDigestEnabled: user.emailDigestEnabled,
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

    const userId = String(req.user.id);
    const user = await userModel
      .findById(userId)
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

export const getCurrentUser = getUserData;

// @desc    Get dashboard preferences
// @route   GET /api/user/preferences/dashboard
// @access  Private
export const getDashboardPreferences = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }
    const userId = String(req.user.id);
    const user = await userModel
      .findById(userId)
      .select("dashboardPreferences");

    if (user) {
      sendSuccess(res, {
        dashboardPreferences: user.dashboardPreferences || null,
      });
    } else {
      return sendError(res, 404, "User not found");
    }
  } catch (error) {
    console.error("Error in getDashboardPreferences:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Update dashboard preferences
// @route   PUT /api/user/preferences/dashboard
// @access  Private
export const updateDashboardPreferences = async (req, res) => {
  try {
    const { dashboardPreferences } = req.body;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const userId = String(req.user.id);
    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          dashboardPreferences: dashboardPreferences,
        },
      },
      { new: true },
    );

    if (!updatedUser) {
      return sendError(res, 404, "User not found.");
    }

    sendSuccess(
      res,
      { dashboardPreferences: updatedUser.dashboardPreferences },
      "Dashboard preferences updated successfully.",
    );
  } catch (error) {
    console.error("Error in updateDashboardPreferences:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Update user profile
// @route   PUT /api/user/update
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const { name, profilePic, bio, emailDigestEnabled } = req.body;

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

    const userId = String(req.user.id);
    const updatedUser = await userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            name: name.trim(),
            profilePic: profilePic ? profilePic.trim() : "",
            bio: bio ? bio.trim() : "",
            ...(emailDigestEnabled !== undefined && { emailDigestEnabled }),
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

// @desc    Upload avatar image
// @route   POST /api/user/avatar
// @access  Private
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }
    if (!req.file) {
      return sendError(res, 400, "No avatar file provided.");
    }

    const userId = String(req.user.id || req.user._id);
    const profilePicUrl = `/uploads/avatars/${req.file.filename}`;

    const user = await userModel.findById(userId);
    if (!user) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return sendError(res, 404, "User not found.");
    }

    // Delete old local avatar file if it exists and is local
    if (user.profilePic && user.profilePic.startsWith("/uploads/avatars/")) {
      const oldPath = path.resolve(user.profilePic.substring(1));
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (err) {
          console.warn("Failed to delete old avatar file:", err);
        }
      }
    }

    user.profilePic = profilePicUrl;
    await user.save();

    return sendSuccess(
      res,
      { profilePic: profilePicUrl },
      "Avatar uploaded successfully.",
    );
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Error in uploadAvatar:", error);
    sendError(res, 500, "Server error during avatar upload.");
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

    const userId = String(req.user.id);
    const user = await userModel.findById(userId);
    if (!user) {
      return sendError(res, 404, "User not found.");
    }

    const COOLDOWN_MS = 24 * 60 * 60 * 1000;

    if (user.lastExportRequestedAt) {
      const timeSinceLastExport =
        Date.now() - new Date(user.lastExportRequestedAt).getTime();
      if (timeSinceLastExport < COOLDOWN_MS) {
        const hoursRemaining = Math.ceil(
          (COOLDOWN_MS - timeSinceLastExport) / (60 * 60 * 1000),
        );
        return sendError(
          res,
          429,
          `You can only request one data export per 24 hours. Please try again in approximately ${hoursRemaining} hour(s).`,
        );
      }
    }

    if (dataExportQueue) {
      await dataExportQueue.add("export", {
        userId: user._id.toString(),
        email: user.email,
      });

      await userModel.findByIdAndUpdate(userId, {
        lastExportRequestedAt: new Date(),
        lastExportStatus: "processing",
        lastExportError: null,
      });

      return sendSuccess(
        res,
        {
          status: "processing",
          requestedAt: new Date(),
        },
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

// @desc    Get current user's data export status and download link
// @route   GET /api/user/data-export-status
// @access  Private
export const getDataExportStatus = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const userId = String(req.user.id);
    const user = await userModel.findById(userId);
    if (!user) {
      return sendError(res, 404, "User not found.");
    }

    const COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const timeSinceLast = user.lastExportRequestedAt
      ? Date.now() - new Date(user.lastExportRequestedAt).getTime()
      : Infinity;

    const canRequest = timeSinceLast >= COOLDOWN_MS;
    const cooldownRemainingMs = canRequest
      ? 0
      : Math.max(0, COOLDOWN_MS - timeSinceLast);
    const cooldownHoursRemaining = canRequest
      ? 0
      : Math.ceil(cooldownRemainingMs / (60 * 60 * 1000));

    let downloadUrl = null;
    let downloadToken = null;
    let expiresAt = null;
    let status = user.lastExportStatus || "idle";

    // If an export file is recorded, check if it's still available on disk
    if (user.lastExportFile) {
      const exportDir = path.join(__dirname, "..", "uploads", "exports");
      const filePath = path.join(exportDir, user.lastExportFile);

      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const fileAgeMs = Date.now() - stats.mtime.getTime();

        // 24-hour file retention policy
        if (fileAgeMs <= COOLDOWN_MS) {
          const jwtSecret = process.env.JWT_SECRET;
          downloadToken = jwt.sign(
            { userId: user._id.toString(), fileName: user.lastExportFile },
            jwtSecret,
            { expiresIn: "24h" },
          );
          downloadUrl = `/api/user/download-export/${downloadToken}`;
          expiresAt = new Date(stats.mtime.getTime() + COOLDOWN_MS);
          status = "completed";
        } else {
          // File has expired past retention window
          if (status === "completed") {
            status = "idle";
          }
        }
      } else if (status === "completed") {
        status = "idle";
      }
    }

    return sendSuccess(
      res,
      {
        status,
        lastExportRequestedAt: user.lastExportRequestedAt,
        canRequest,
        cooldownRemainingMs,
        cooldownHoursRemaining,
        downloadUrl,
        downloadToken,
        expiresAt,
        error: user.lastExportError || null,
      },
      "Data export status retrieved successfully.",
    );
  } catch (error) {
    console.error("Error in getDataExportStatus:", error);
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

    const { fileName, userId } = decoded;
    if (!fileName || !userId) {
      return sendError(res, 400, "Invalid token payload.");
    }

    // Verify fileName structure conforms to user export naming
    if (
      !fileName.startsWith(`export_${userId}_`) ||
      !fileName.endsWith(".zip")
    ) {
      return sendError(
        res,
        403,
        "Unauthorized access to requested export file.",
      );
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
