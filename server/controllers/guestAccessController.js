import GuestAccessService from "../services/guestAccessService.js";
import Meeting from "../models/meetingModel.js";
import Comment from "../models/commentModel.js";
import ActionItem from "../models/actionItemModel.js";
import mongoose from "mongoose";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  UnauthorizedError,
} from "../utils/errors.js";

/**
 * Controller for managing guest access tokens and host analytics feedback loop.
 */
class GuestAccessController {
  // --- Authenticated routes for hosts / admins ---

  static async createToken(req, res, next) {
    try {
      const { meetingId } = req.params;
      const { guestEmail, label, permissions, expiresAt, maxViews } = req.body;
      const createdBy = req.user._id || req.user.id;

      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        return next(new NotFoundError("Meeting not found"));
      }

      if (
        req.user.organization &&
        meeting.organization &&
        meeting.organization.toString() !== req.user.organization.toString()
      ) {
        return next(
          new ForbiddenError("Unauthorized to create token for this meeting"),
        );
      }

      const { rawToken, guestToken } = await GuestAccessService.generateToken({
        meetingId,
        guestEmail,
        label,
        permissions,
        expiresAt: new Date(expiresAt),
        maxViews,
        createdBy,
        organizationId: req.user.organization,
      });

      return res.status(201).json({
        message: "Guest token created successfully",
        token: rawToken,
        tokenRecord: guestToken,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getMeetingTokens(req, res, next) {
    try {
      const { meetingId } = req.params;
      const userId = req.user?._id || req.user?.id;

      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        return next(new NotFoundError("Meeting not found"));
      }

      const tokens = await GuestAccessService.getMeetingTokens(meetingId);
      return res.status(200).json(tokens);
    } catch (error) {
      return next(error);
    }
  }

  static async revokeToken(req, res, next) {
    try {
      const { tokenId } = req.params;
      const revokedBy = req.user._id || req.user.id;

      const revokedToken = await GuestAccessService.revokeToken(
        tokenId,
        revokedBy,
        req.user.organization,
      );

      return res
        .status(200)
        .json({ message: "Token revoked", token: revokedToken });
    } catch (error) {
      return next(new ValidationError(error.message));
    }
  }

  /**
   * Retrieves join metrics, token audit trails, and feedback records for a specific meeting.
   */
  static async getHostAnalytics(req, res, next) {
    try {
      const meetingId = req.params.meetingId || req.query.meetingId;
      const userId = req.user?._id || req.user?.id;

      if (!meetingId) {
        return next(new ValidationError("Meeting ID is required"));
      }

      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        return next(new NotFoundError("Meeting not found"));
      }

      const isHost =
        meeting.uploadedBy?.toString() === userId?.toString() ||
        meeting.host?.toString() === userId?.toString();
      const isAdmin =
        req.user?.role === "admin" ||
        req.user?.role === "owner" ||
        req.user?.isAdmin;
      const isOrgMember =
        req.user?.organization &&
        meeting.organization &&
        req.user.organization.toString() === meeting.organization.toString();

      if (!isHost && !isAdmin && !isOrgMember) {
        return next(
          new ForbiddenError("Unauthorized to view analytics for this meeting"),
        );
      }

      const analytics = await GuestAccessService.getHostAnalytics(meetingId);
      return res.status(200).json(analytics);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Streams room feedback matrices directly as a CSV download.
   */
  static async exportFeedbackCSV(req, res, next) {
    try {
      const meetingId = req.params.meetingId || req.query.meetingId;

      if (!meetingId) {
        return next(new ValidationError("Meeting ID is required"));
      }

      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        return next(new NotFoundError("Meeting not found"));
      }

      const userId = req.user?._id || req.user?.id;
      const isHost =
        meeting.uploadedBy?.toString() === userId?.toString() ||
        meeting.host?.toString() === userId?.toString();
      const isAdmin =
        req.user?.role === "admin" ||
        req.user?.role === "owner" ||
        req.user?.isAdmin;
      const isOrgMember =
        req.user?.organization &&
        meeting.organization &&
        req.user.organization.toString() === meeting.organization.toString();

      if (!isHost && !isAdmin && !isOrgMember) {
        return next(
          new ForbiddenError(
            "Unauthorized to export feedback for this meeting",
          ),
        );
      }

      const csvContent = await GuestAccessService.exportFeedbackCSV(meetingId);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=meeting-${meetingId}-feedback.csv`,
      );
      return res.status(200).send(csvContent);
    } catch (error) {
      return next(error);
    }
  }

  // --- Unauthenticated routes for guests ---

  static async getGuestMeetingData(req, res, next) {
    try {
      const { token } = req.params;

      const validToken = await GuestAccessService.validateAndRecordView(token);

      const meetingId = validToken.meetingId._id || validToken.meetingId;
      const meeting = await Meeting.findById(meetingId).select(
        "title date status organization",
      );

      if (!meeting) {
        return next(new NotFoundError("Meeting not found"));
      }

      const responseData = {
        meeting: {
          _id: meeting._id,
          title: meeting.title,
          date: meeting.date,
          status: meeting.status,
        },
        permissions: validToken.permissions,
        guestEmail: validToken.guestEmail,
      };

      if (validToken.permissions.includes("view_transcript")) {
        const MeetingModel = mongoose.model("Meeting");
        const meetingWithTranscript =
          await MeetingModel.findById(meetingId).select("transcript");
        responseData.transcript = meetingWithTranscript.transcript;
      }

      if (validToken.permissions.includes("view_summary")) {
        const meetingWithSummary =
          await Meeting.findById(meetingId).select("aiSummary");
        responseData.aiSummary = meetingWithSummary.aiSummary;
      }

      if (validToken.permissions.includes("view_action_items")) {
        responseData.actionItems = await ActionItem.find({
          meeting: meetingId,
        });
      }

      return res.status(200).json(responseData);
    } catch (error) {
      return next(new UnauthorizedError(error.message));
    }
  }

  static async recordGuestJoin(req, res, next) {
    try {
      const { token } = req.params;
      const updatedToken = await GuestAccessService.recordJoin(token);
      return res.status(200).json({ success: true, token: updatedToken });
    } catch (error) {
      return next(new ValidationError(error.message));
    }
  }

  static async addGuestComment(req, res, next) {
    try {
      const { token } = req.params;
      const { body } = req.body;

      const validToken = await GuestAccessService.validateAndRecordView(token);

      if (!validToken.permissions.includes("add_comments")) {
        return next(
          new ForbiddenError("Token does not grant comment permission"),
        );
      }

      const meetingId = validToken.meetingId._id || validToken.meetingId;
      const meeting = await Meeting.findById(meetingId).select("organization");

      const comment = await Comment.create({
        meeting: meetingId,
        organization: meeting.organization,
        body,
        guestEmail: validToken.guestEmail,
      });

      return res.status(201).json({ message: "Comment added", comment });
    } catch (error) {
      return next(new ValidationError(error.message));
    }
  }

  static async submitGuestFeedback(req, res, next) {
    try {
      const { token } = req.params;
      const { rating, comments, guestName } = req.body;

      const validToken = await GuestAccessService.validateAndRecordView(token);
      const meetingId = validToken.meetingId._id || validToken.meetingId;

      const feedback = await GuestAccessService.submitFeedback({
        meetingId,
        token,
        guestName: guestName || validToken.guestEmail || "Anonymous Guest",
        guestEmail: validToken.guestEmail,
        rating,
        comments,
      });

      return res
        .status(201)
        .json({ message: "Feedback submitted successfully", feedback });
    } catch (error) {
      return next(new ValidationError(error.message));
    }
  }
}

export const getHostAnalytics = GuestAccessController.getHostAnalytics;
export const exportFeedbackCSV = GuestAccessController.exportFeedbackCSV;
export const createToken = GuestAccessController.createToken;
export const getMeetingTokens = GuestAccessController.getMeetingTokens;
export const revokeToken = GuestAccessController.revokeToken;
export const getGuestMeetingData = GuestAccessController.getGuestMeetingData;
export const addGuestComment = GuestAccessController.addGuestComment;
export const submitGuestFeedback = GuestAccessController.submitGuestFeedback;
export const recordGuestJoin = GuestAccessController.recordGuestJoin;

export default GuestAccessController;
