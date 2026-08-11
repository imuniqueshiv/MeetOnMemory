import SharedLink from "../models/sharedLinkModel.js";
import Meeting from "../models/meetingModel.js";
import Policy from "../models/policyModel.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { hasPermission } from "../utils/rbacPermissions.js";
import logger from "../utils/logger.js";
import {
  SHARED_LINK_PASSCODE_AUTH_FAILURE_MESSAGE,
  SHARED_LINK_PASSCODE_LOCKOUT_MS,
  SHARED_LINK_PASSCODE_MAX_ATTEMPTS,
  hasPasscodeLockExpired,
  isPasscodeLocked,
} from "../utils/sharedLinkSecurity.js";

const getSharedLinkJwtSecret = () =>
  process.env.SHARED_LINK_JWT_SECRET ||
  process.env.SHARED_LINK_SECRET ||
  process.env.JWT_SECRET ||
  "default_shared_link_secret";

/**
 * Maps shareable resource types to their Mongoose models.
 * Keys must stay in sync with the `resourceModel` enum on sharedLinkModel.
 */
export const SHARE_MODELS_BY_TYPE = Object.freeze({
  Meeting,
  Policy,
});

export const SHAREABLE_RESOURCE_TYPES = Object.freeze(
  Object.keys(SHARE_MODELS_BY_TYPE),
);

/**
 * Validates the optional `expirationDate`.
 *
 * `new Date(garbage)` yields `Invalid Date`, which Mongoose stores as null and
 * silently turns a link the caller believed was time-boxed into one that never
 * expires. A past date is rejected too — a link that is born expired is a
 * request the caller got wrong, not a link worth creating.
 *
 * @returns {{ok: true, value: Date|null} | {ok: false, message: string}}
 */
export const parseExpirationDate = (raw) => {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: null };
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, message: "Invalid expiration date" };
  }

  if (parsed.getTime() <= Date.now()) {
    return { ok: false, message: "Expiration date must be in the future" };
  }

  return { ok: true, value: parsed };
};

const generateHash = () => {
  return crypto.randomBytes(16).toString("hex");
};

const analyticsPermissionFor = (resourceModel) =>
  resourceModel === "Policy" ? "policies" : "meetings";

const canViewAnalytics = (user, resourceModel) =>
  hasPermission(user?.role, analyticsPermissionFor(resourceModel), "edit");

const toPublicLink = (link, includeAnalytics) => {
  const base = {
    _id: link._id,
    hash: link.hash,
    expirationDate: link.expirationDate,
    hasPasscode: !!link.passcode,
    active: link.active,
    createdAt: link.createdAt,
  };

  if (!includeAnalytics) return base;

  return {
    ...base,
    totalViews: link.totalViews || 0,
    lastAccessed: link.lastAccessed || null,
    failedPasscodeAttempts: link.failedPasscodeAttempts || 0,
  };
};

/** Fire-and-forget analytics — never blocks or fails the access response. */
const recordSuccessfulAccess = (linkId) => {
  SharedLink.findByIdAndUpdate(linkId, {
    $inc: { totalViews: 1 },
    $set: { lastAccessed: new Date() },
  }).catch((err) =>
    console.error("Failed to record shared link view:", err.message),
  );
};

const clearPasscodeLockout = (linkId) =>
  SharedLink.findByIdAndUpdate(linkId, {
    $set: {
      failedPasscodeAttempts: 0,
      passcodeLockUntil: null,
    },
  });

/**
 * Records a failed attempt and engages lockout once the threshold is reached.
 * Returns the updated document (or null if the update failed).
 */
const recordFailedPasscodeAttempt = async (link) => {
  try {
    const updated = await SharedLink.findByIdAndUpdate(
      link._id,
      { $inc: { failedPasscodeAttempts: 1 } },
      { new: true },
    );

    if (!updated) return null;

    if (updated.failedPasscodeAttempts >= SHARED_LINK_PASSCODE_MAX_ATTEMPTS) {
      const passcodeLockUntil = new Date(
        Date.now() + SHARED_LINK_PASSCODE_LOCKOUT_MS,
      );
      await SharedLink.findByIdAndUpdate(link._id, {
        $set: { passcodeLockUntil },
      });

      logger.warn("Shared link passcode lockout engaged", {
        linkId: String(link._id),
        organizationId: link.organizationId
          ? String(link.organizationId)
          : null,
        resourceModel: link.resourceModel,
        failedPasscodeAttempts: updated.failedPasscodeAttempts,
        passcodeLockUntil: passcodeLockUntil.toISOString(),
      });
    } else if (
      updated.failedPasscodeAttempts >=
      Math.max(1, SHARED_LINK_PASSCODE_MAX_ATTEMPTS - 1)
    ) {
      // One attempt remaining before lockout — useful signal without leaking
      // lockout details to the client.
      logger.warn("Shared link passcode nearing lockout threshold", {
        linkId: String(link._id),
        organizationId: link.organizationId
          ? String(link.organizationId)
          : null,
        failedPasscodeAttempts: updated.failedPasscodeAttempts,
        maxAttempts: SHARED_LINK_PASSCODE_MAX_ATTEMPTS,
      });
    }

    return updated;
  } catch (err) {
    console.error("Failed to record failed passcode attempt:", err.message);
    return null;
  }
};

const sendPasscodeAuthFailure = (res) =>
  res.status(401).json({
    success: false,
    message: SHARED_LINK_PASSCODE_AUTH_FAILURE_MESSAGE,
  });

export const createLink = async (req, res) => {
  try {
    const { resourceId, resourceType, expirationDate, passcode } = req.body;

    if (!resourceId || !resourceType) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Ownership + org checks run on the live create path (Issue #1070).
    if (!SHARE_MODELS_BY_TYPE[resourceType]) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid resource type" });
    }

    const userRole = req.user?.role || "guest";
    const resourceCategory =
      resourceType === "Policy" ? "policies" : "meetings";
    if (
      !hasPermission(userRole, resourceCategory, "edit") &&
      !hasPermission(userRole, resourceCategory, "create")
    ) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Insufficient permissions to create shared links for ${resourceType.toLowerCase()}`,
      });
    }

    if (!mongoose.isValidObjectId(resourceId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid resource ID" });
    }

    const callerOrg = req.user?.organization;
    if (!callerOrg) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Resource does not belong to your organization",
      });
    }

    const resource = await SHARE_MODELS_BY_TYPE[resourceType]
      .findById(String(resourceId))
      .select("organization");

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: `${resourceType} not found`,
      });
    }

    if (
      !resource.organization ||
      resource.organization.toString() !== callerOrg.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Resource does not belong to your organization",
      });
    }

    const expiration = parseExpirationDate(expirationDate);
    if (!expiration.ok) {
      return res
        .status(400)
        .json({ success: false, message: expiration.message });
    }

    let hashedPasscode = null;
    if (passcode) {
      const salt = await bcrypt.genSalt(10);
      hashedPasscode = await bcrypt.hash(passcode, salt);
    }

    const hash = generateHash();

    const newLink = new SharedLink({
      resourceId,
      resourceModel: resourceType,
      hash,
      expirationDate: expiration.value,
      passcode: hashedPasscode,
      createdBy: req.user._id,
      organizationId: req.user.organization,
    });

    await newLink.save();

    res.status(201).json({
      success: true,
      link: toPublicLink(newLink, canViewAnalytics(req.user, resourceType)),
    });
  } catch (error) {
    console.error("Error creating shared link:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error creating link" });
  }
};

export const getActiveLinks = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const userRole = req.user?.role || "guest";
    const resourceCategory =
      resourceType === "Policy" ? "policies" : "meetings";

    if (!hasPermission(userRole, resourceCategory, "view")) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Insufficient permissions to view shared links for ${resourceType.toLowerCase()}`,
      });
    }

    const includeAnalytics = canViewAnalytics(req.user, resourceType);

    const links = await SharedLink.find({
      resourceId,
      resourceModel: resourceType,
      organizationId: req.user.organization,
      active: true,
    });

    res.status(200).json({
      success: true,
      links: links.map((link) => toPublicLink(link, includeAnalytics)),
    });
  } catch (error) {
    console.error("Error fetching active links:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching links" });
  }
};

export const revokeLink = async (req, res) => {
  try {
    const { id } = req.params;

    const link = await SharedLink.findOne({
      _id: id,
      organizationId: req.user?.organization,
    });
    if (!link) {
      return res
        .status(404)
        .json({ success: false, message: "Link not found" });
    }

    const userRole = req.user?.role || "guest";
    const resourceCategory =
      link.resourceModel === "Policy" ? "policies" : "meetings";
    if (
      !hasPermission(userRole, resourceCategory, "edit") &&
      !hasPermission(userRole, resourceCategory, "delete")
    ) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Insufficient permissions to revoke shared links for ${link.resourceModel.toLowerCase()}`,
      });
    }

    link.active = false;
    await link.save();

    res
      .status(200)
      .json({ success: true, message: "Link revoked successfully" });
  } catch (error) {
    console.error("Error revoking link:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error revoking link" });
  }
};

// Public endpoints

export const verifyPasscode = async (req, res) => {
  try {
    const { hash } = req.params;
    const { passcode } = req.body;

    const link = await SharedLink.findOne({ hash, active: true });

    if (!link) {
      return res
        .status(404)
        .json({ success: false, message: "Link not found or inactive" });
    }

    if (link.expirationDate && new Date() > link.expirationDate) {
      return res
        .status(403)
        .json({ success: false, message: "Link has expired" });
    }

    if (!link.passcode) {
      return res
        .status(200)
        .json({ success: true, message: "No passcode required" });
    }

    // Active lockout: reject without running bcrypt (Issue #1111).
    // Same generic message as a wrong passcode so callers cannot probe state.
    if (isPasscodeLocked(link)) {
      return sendPasscodeAuthFailure(res);
    }

    // Expired lockout clears automatically on the next verification attempt.
    if (hasPasscodeLockExpired(link)) {
      await clearPasscodeLockout(link._id);
      link.failedPasscodeAttempts = 0;
      link.passcodeLockUntil = null;
    }

    if (!passcode) {
      return res
        .status(400)
        .json({ success: false, message: "Passcode required" });
    }

    const isMatch = await bcrypt.compare(passcode, link.passcode);
    if (!isMatch) {
      await recordFailedPasscodeAttempt(link);
      return sendPasscodeAuthFailure(res);
    }

    // Successful verification resets consecutive failures / lockout.
    await clearPasscodeLockout(link._id);

    // Generate a short-lived token to access the resource
    const token = jwt.sign(
      { linkId: link._id, hash: link.hash },
      getSharedLinkJwtSecret(),
      { expiresIn: "1h" },
    );

    res.cookie("shared_access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 3600000, // 1 hour
    });

    res.status(200).json({ success: true, message: "Passcode verified" });
  } catch (error) {
    console.error("Error verifying passcode:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error verifying passcode" });
  }
};

export const getPublicResource = async (req, res) => {
  try {
    const { hash } = req.params;

    const link = await SharedLink.findOne({ hash, active: true });
    if (!link) {
      return res
        .status(404)
        .json({ success: false, message: "Link not found or inactive" });
    }

    if (link.expirationDate && new Date() > link.expirationDate) {
      return res
        .status(403)
        .json({ success: false, message: "Link has expired" });
    }

    if (link.passcode) {
      const token = req.cookies?.shared_access_token;
      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Passcode required",
          requiresPasscode: true,
        });
      }

      let decoded = null;
      try {
        decoded = jwt.verify(token, getSharedLinkJwtSecret());
      } catch (_err) {
        decoded = null;
      }

      if (!decoded || decoded.hash !== hash) {
        return res.status(401).json({
          success: false,
          message: !decoded
            ? "Session expired, please re-enter passcode"
            : "Invalid access token",
          requiresPasscode: true,
        });
      }
    }

    let resourceData = null;

    if (link.resourceModel === "Meeting") {
      const meeting = await Meeting.findById(link.resourceId)
        .select(
          "title description date time location " +
            "participants summary structuredMoM",
        )
        .lean();

      if (!meeting) {
        return res
          .status(404)
          .json({ success: false, message: "Meeting not found" });
      }

      resourceData = {
        title: meeting.title,
        description: meeting.description,
        date: meeting.date,
        time: meeting.time,
        location: meeting.location,
        summary: meeting.summary,
        structuredMoM: meeting.structuredMoM,
        participants: meeting.participants
          ? Array(meeting.participants.length).fill({})
          : [],
      };
    } else if (link.resourceModel === "Policy") {
      const policy = await Policy.findById(link.resourceId)
        .select("name version summary key_changes")
        .lean();

      if (!policy) {
        return res
          .status(404)
          .json({ success: false, message: "Policy not found" });
      }

      resourceData = {
        name: policy.name,
        version: policy.version,
        summary: policy.summary,
        key_changes: policy.key_changes,
      };
    } else {
      // Enum should prevent this; treat unexpected models as not found.
      return res.status(404).json({
        success: false,
        message: "Link not found or inactive",
      });
    }

    // Record view only after successful access; never include analytics in public payload
    recordSuccessfulAccess(link._id);

    res.status(200).json({
      success: true,
      resourceType: link.resourceModel,
      data: resourceData,
    });
  } catch (error) {
    console.error("Error fetching public resource:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching resource" });
  }
};
