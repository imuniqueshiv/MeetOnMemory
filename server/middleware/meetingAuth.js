import Meeting from "../models/meetingModel.js";

/**
 * @desc Middleware to verify the authenticated user has access to the specified meeting.
 * Prevents cross-organization data leakage.
 */
export const verifyMeetingAccess = async (req, res, next) => {
  try {
    const meetingId = req.params.meetingId || req.body.meetingId;
    if (!meetingId)
      return res
        .status(400)
        .json({ success: false, error: "Meeting ID required" });
    // server/middleware/meetingAuth.js
const Meeting = require('../models/Meeting'); // Adjust path to your Meeting model as needed

const meetingAuth = async (req, res, next) => {
  try {
    const meetingId = req.params.meetingId || req.body.meetingId;
    
    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID is required.' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }

    // 1. Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // 2. Preserve existing owner/admin bypass checks
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const isOwner = meeting.owner && meeting.owner.toString() === req.user._id.toString();

    // 3. Fail closed if organization data is missing on either the user or the meeting
    if (!isAdmin && (!req.user.organization || !meeting.organization)) {
      return res.status(403).json({ error: 'Access denied. Missing organization information.' });
    }

    // 4. Compare the actual organization fields (convert to strings if using MongoDB ObjectIds)
    const isSameOrganization = req.user.organization && meeting.organization && 
                               req.user.organization.toString() === meeting.organization.toString();

    if (!isAdmin && !isOwner && !isSameOrganization) {
      return res.status(403).json({ error: 'Access denied. Cross-organization access is prohibited.' });
    }

    // Attach meeting to request for downstream consumers
    req.meeting = meeting;
    next();
  } catch (error) {
    console.error('Authorization error in meetingAuth:', error);
    res.status(500).json({ error: 'Internal server error during authorization.' });
  }
};

module.exports = meetingAuth;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting)
      return res
        .status(404)
        .json({ success: false, error: "Meeting not found" });

    // Verify organization/tenant match
    if (
      meeting.organizationId?.toString() !== req.user.organizationId?.toString()
    ) {
      return res
        .status(403)
        .json({ success: false, error: "Unauthorized access to meeting" });
    }

    req.meeting = meeting;
    next();
  } catch (_err) {
    res
      .status(500)
      .json({ success: false, error: "Server error during authorization" });
  }
};

/**
 * @desc Middleware to verify the authenticated user has access to a specific action item.
 */
export const verifyActionItemAccess = async (req, res, next) => {
  try {
    const ActionItem = (await import("../models/ActionItem.js")).default;
    const item = await ActionItem.findById(req.params.id).populate("meetingId");

    if (!item)
      return res
        .status(404)
        .json({ success: false, error: "Action item not found" });

    if (
      item.meetingId.organizationId?.toString() !==
      req.user.organizationId?.toString()
    ) {
      return res
        .status(403)
        .json({ success: false, error: "Unauthorized access to action item" });
    }

    req.actionItem = item;
    next();
  } catch (_err) {
    res
      .status(500)
      .json({ success: false, error: "Server error during authorization" });
  }
};
