import mongoose from "mongoose";
import { z } from "zod";
import PersonalNote from "../models/personalNoteModel.js";
import Meeting from "../models/meetingModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";

/**
 * Maximum character limits for note fields
 * These limits prevent payload bloat and frontend layout issues
 */
const MAX_NOTE_TITLE_LENGTH = 200;
const MAX_NOTE_CONTENT_LENGTH = 50000; // 50KB of text
const MAX_ANNOTATION_TEXT_LENGTH = 5000;

/**
 * Zod schema for validating note content updates
 * Enforces maximum length limits to prevent abuse
 */
const noteContentSchema = z.object({
  content: z
    .string()
    .max(
      MAX_NOTE_CONTENT_LENGTH,
      `Note content cannot exceed ${MAX_NOTE_CONTENT_LENGTH} characters`,
    )
    .optional()
    .default(""),
  title: z
    .string()
    .max(
      MAX_NOTE_TITLE_LENGTH,
      `Note title cannot exceed ${MAX_NOTE_TITLE_LENGTH} characters`,
    )
    .optional()
    .default(""),
});

/**
 * Zod schema for validating annotation data
 * Ensures annotation text stays within reasonable limits
 */
const annotationSchema = z.object({
  annotationText: z
    .string()
    .min(1, "Annotation text is required")
    .max(
      MAX_ANNOTATION_TEXT_LENGTH,
      `Annotation text cannot exceed ${MAX_ANNOTATION_TEXT_LENGTH} characters`,
    ),
  sourceField: z.enum(["transcript", "summary"]).default("transcript"),
  offsets: z.object({
    start: z.number().min(0, "Start offset must be non-negative"),
    end: z.number().min(0, "End offset must be non-negative"),
  }),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color")
    .default("#ffeb3b"),
});

/**
 * Resolve and validate meeting access for a user
 *
 * @param {string} meetingId - Meeting ID to check
 * @param {Object} user - User object from request
 * @returns {Promise<Object>} Access result with meeting or error
 */
const resolveAccessibleMeeting = async (meetingId, user) => {
  // Validate meeting ID format
  if (!mongoose.isValidObjectId(meetingId)) {
    return {
      error: {
        status: 400,
        message: "Invalid meeting ID format",
      },
    };
  }

  // Fetch meeting from database
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    return {
      error: {
        status: 404,
        message: "Meeting not found",
      },
    };
  }

  // Check if user is the meeting owner
  const isOwner = meeting.uploadedBy?.toString() === user._id.toString();

  // Check if user belongs to the same organization
  const isInSameOrg =
    meeting.organization &&
    user.organization &&
    meeting.organization.toString() === user.organization.toString();

  // User must be owner OR in same organization
  if (!isOwner && !isInSameOrg) {
    return {
      error: {
        status: 403,
        message: "Forbidden: You don't have access to this meeting",
      },
    };
  }

  return { meeting };
};

/**
 * Helper to fetch all meeting IDs that a user is authorized to access.
 * A user has access to a meeting if they uploaded it OR if it belongs to their organization.
 *
 * @param {Object} user - User object from request
 * @returns {Promise<Array<mongoose.Types.ObjectId>>} Array of accessible meeting IDs
 */
const getAccessibleMeetingIds = async (user) => {
  const query = {
    $or: [{ uploadedBy: user._id }],
  };
  if (user.organization) {
    query.$or.push({ organization: user.organization });
  }
  const meetings = await Meeting.find(query).select("_id");
  return meetings.map((m) => m._id);
};

// @desc Get personal note for a specific meeting
// @route GET /api/personal-notes/:meetingId
// @access Private
export const getNoteByMeetingId = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    // Enforce RBAC permission
    if (
      !req.user?.role ||
      !hasPermission(req.user.role, "personal_notes", "view")
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to view personal notes",
      });
    }

    // Verify user has access to this meeting
    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, message: access.error.message });
    }

    // Fetch note for this user and meeting
    let note = await PersonalNote.findOne({ userId, meetingId });

    if (note && note.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not own this note",
      });
    }

    // Return empty structure if note doesn't exist (prevents 404)
    if (!note) {
      return res.status(200).json({
        success: true,
        note: {
          title: "",
          content: "",
          annotations: [],
          isPinned: false,
          limits: {
            maxTitleLength: MAX_NOTE_TITLE_LENGTH,
            maxContentLength: MAX_NOTE_CONTENT_LENGTH,
          },
        },
      });
    }

    // Include limits in response for frontend validation
    const noteWithLimits = note.toObject();
    noteWithLimits.limits = {
      maxTitleLength: MAX_NOTE_TITLE_LENGTH,
      maxContentLength: MAX_NOTE_CONTENT_LENGTH,
    };

    res.status(200).json({
      success: true,
      note: noteWithLimits,
    });
  } catch (error) {
    console.error("Error fetching personal note:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc Upsert personal note content and title
// @route POST /api/personal-notes/:meetingId
// @access Private
export const upsertNote = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    // Enforce RBAC permission
    if (
      !req.user?.role ||
      !hasPermission(req.user.role, "personal_notes", "edit")
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Forbidden: You do not have permission to modify personal notes",
      });
    }

    // Verify user has access to this meeting
    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, message: access.error.message });
    }

    // Validate request body with Zod schema
    const parsed = noteContentSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessage = parsed.error.issues[0]?.message || "Invalid input";
      return res.status(400).json({
        success: false,
        message: errorMessage,
        errors: parsed.error.issues,
      });
    }

    const { content = "", title = "" } = parsed.data;

    // Find existing note or prepare to create new one
    let note = await PersonalNote.findOne({ userId, meetingId });

    if (note && note.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not own this note",
      });
    }

    if (note) {
      // Update existing note
      note.content = content;
      note.title = title;
      await note.save();
    } else {
      // Create new note
      note = await PersonalNote.create({
        userId,
        meetingId,
        content,
        title,
      });
    }

    // Include limits in response
    const noteWithLimits = note.toObject();
    noteWithLimits.limits = {
      maxTitleLength: MAX_NOTE_TITLE_LENGTH,
      maxContentLength: MAX_NOTE_CONTENT_LENGTH,
      currentTitleLength: title.length,
      currentContentLength: content.length,
    };

    res.status(200).json({
      success: true,
      note: noteWithLimits,
    });
  } catch (error) {
    console.error("Error upserting personal note:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc Update note title only
// @route PATCH /api/personal-notes/:meetingId/title
// @access Private
export const updateNoteTitle = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;
    const { title } = req.body;

    // Enforce RBAC permission
    if (
      !req.user?.role ||
      !hasPermission(req.user.role, "personal_notes", "edit")
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to edit personal notes",
      });
    }

    // Verify user has access to this meeting
    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, message: access.error.message });
    }

    // Validate title length
    if (typeof title !== "string") {
      return res.status(400).json({
        success: false,
        message: "Title must be a string",
      });
    }

    if (title.length > MAX_NOTE_TITLE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Title cannot exceed ${MAX_NOTE_TITLE_LENGTH} characters`,
        currentLength: title.length,
        maxLength: MAX_NOTE_TITLE_LENGTH,
      });
    }

    // Find and update note
    let note = await PersonalNote.findOne({ userId, meetingId });

    if (note && note.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not own this note",
      });
    }

    if (note) {
      note.title = title;
      await note.save();
    } else {
      note = await PersonalNote.create({
        userId,
        meetingId,
        title,
        content: "",
      });
    }

    res.status(200).json({
      success: true,
      note,
      titleLength: title.length,
      maxLength: MAX_NOTE_TITLE_LENGTH,
    });
  } catch (error) {
    console.error("Error updating note title:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc Add an annotation to a personal note
// @route POST /api/personal-notes/:meetingId/annotations
// @access Private
export const addAnnotation = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    // Enforce RBAC permission
    if (
      !req.user?.role ||
      !hasPermission(req.user.role, "personal_notes", "edit")
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to edit personal notes",
      });
    }

    // Verify user has access to this meeting
    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, message: access.error.message });
    }

    // Validate annotation data with Zod schema
    const parsed = annotationSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessage =
        parsed.error.issues[0]?.message || "Invalid annotation";
      return res.status(400).json({
        success: false,
        message: errorMessage,
        errors: parsed.error.issues,
      });
    }

    const { annotationText, sourceField, offsets, color } = parsed.data;

    // Validate offset range
    if (offsets.end <= offsets.start) {
      return res.status(400).json({
        success: false,
        message: "End offset must be greater than start offset",
      });
    }

    // Find existing note or create new one
    let note = await PersonalNote.findOne({ userId, meetingId });

    if (note && note.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not own this note",
      });
    }

    if (!note) {
      note = await PersonalNote.create({
        userId,
        meetingId,
        content: "",
        title: "",
      });
    }

    // Add annotation to note
    note.annotations.push({
      annotationText,
      sourceField,
      offsets,
      color,
    });

    await note.save();

    res.status(200).json({
      success: true,
      note,
      annotationCount: note.annotations.length,
    });
  } catch (error) {
    console.error("Error adding annotation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc Remove an annotation from a personal note
// @route DELETE /api/personal-notes/:meetingId/annotations/:annotationId
// @access Private
export const removeAnnotation = async (req, res) => {
  try {
    const { meetingId, annotationId } = req.params;
    const userId = req.user._id;

    // Enforce RBAC permission
    if (
      !req.user?.role ||
      !hasPermission(req.user.role, "personal_notes", "edit")
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to edit personal notes",
      });
    }

    // Verify user has access to this meeting
    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, message: access.error.message });
    }

    // Find the note
    const note = await PersonalNote.findOne({ userId, meetingId });
    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    if (note.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not own this note",
      });
    }

    // Remove annotation by ID
    const initialLength = note.annotations.length;
    note.annotations = note.annotations.filter(
      (ann) => ann._id.toString() !== annotationId,
    );

    if (note.annotations.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: "Annotation not found",
      });
    }

    await note.save();

    res.status(200).json({
      success: true,
      note,
      message: "Annotation removed successfully",
    });
  } catch (error) {
    console.error("Error removing annotation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc Toggle pin status of a personal note
// @route PATCH /api/personal-notes/:meetingId/pin
// @access Private
export const togglePin = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    // Enforce RBAC permission
    if (
      !req.user?.role ||
      !hasPermission(req.user.role, "personal_notes", "pin")
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to pin personal notes",
      });
    }

    // Verify user has access to this meeting
    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, message: access.error.message });
    }

    // Find the note
    let note = await PersonalNote.findOne({ userId, meetingId });

    if (note && note.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not own this note",
      });
    }

    if (!note) {
      // Create note if it doesn't exist (pinned by default or set explicitly)
      note = await PersonalNote.create({
        userId,
        meetingId,
        content: "",
        title: "",
        isPinned: req.body.isPinned !== undefined ? req.body.isPinned : true,
      });
    } else {
      // Toggle pin status or set explicitly
      note.isPinned =
        req.body.isPinned !== undefined ? req.body.isPinned : !note.isPinned;
      await note.save();
    }

    res.status(200).json({
      success: true,
      note,
      isPinned: note.isPinned,
    });
  } catch (error) {
    console.error("Error toggling pin:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc Get all pinned notes for the current user
// @route GET /api/personal-notes/pinned
// @access Private
export const getPinnedNotes = async (req, res) => {
  try {
    const userId = req.user._id;

    // Enforce RBAC permission
    if (
      !req.user?.role ||
      !hasPermission(req.user.role, "personal_notes", "view")
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to view personal notes",
      });
    }

    // Filter notes by accessible meetings
    const meetingIds = await getAccessibleMeetingIds(req.user);

    // Fetch all pinned notes for this user
    const pinnedNotes = await PersonalNote.find({
      userId,
      isPinned: true,
      meetingId: { $in: meetingIds },
    })
      .populate("meetingId", "title date organization")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      notes: pinnedNotes,
      count: pinnedNotes.length,
    });
  } catch (error) {
    console.error("Error fetching pinned notes:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc Search personal notes for the current user
// @route GET /api/personal-notes/search
// @access Private
export const searchNotes = async (req, res) => {
  try {
    const userId = req.user._id;
    const { query } = req.query;

    // Enforce RBAC permission
    if (
      !req.user?.role ||
      !hasPermission(req.user.role, "personal_notes", "view")
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to view personal notes",
      });
    }

    // Filter notes by accessible meetings
    const meetingIds = await getAccessibleMeetingIds(req.user);

    const filter = {
      userId,
      meetingId: { $in: meetingIds },
    };
    if (query) {
      if (typeof query !== "string") {
        return res.status(400).json({
          success: false,
          message: "Query must be a string",
        });
      }
      if (query.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Query length cannot exceed 500 characters",
        });
      }
      // Escape regex special characters to prevent ReDoS and regex injection
      const escapedQuery = query.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
      filter.$or = [
        { title: { $regex: escapedQuery, $options: "i" } },
        { content: { $regex: escapedQuery, $options: "i" } },
      ];
    }

    const notes = await PersonalNote.find(filter)
      .populate("meetingId", "title date organization")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      notes,
      count: notes.length,
    });
  } catch (error) {
    console.error("Error searching notes:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc Clear personal note content (title and content)
// @route PUT /api/personal-notes/:meetingId/clear
// @access Private
export const clearNoteContent = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    // Enforce RBAC permission
    if (
      !req.user?.role ||
      !hasPermission(req.user.role, "personal_notes", "edit")
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to edit personal notes",
      });
    }

    // Verify user has access to this meeting
    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, message: access.error.message });
    }

    // Find note
    let note = await PersonalNote.findOne({ userId, meetingId });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    // Verify ownership
    if (note.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not own this note",
      });
    }

    // Clear content and title atomically
    note.content = "";
    note.title = "";
    await note.save();

    res.status(200).json({
      success: true,
      message: "Note content cleared successfully",
      note,
    });
  } catch (error) {
    console.error("Error clearing personal note content:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc Delete personal note document entirely
// @route DELETE /api/personal-notes/:meetingId
// @access Private
export const deleteNote = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    // Enforce RBAC permission
    if (
      !req.user?.role ||
      !hasPermission(req.user.role, "personal_notes", "delete")
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Forbidden: You do not have permission to delete personal notes",
      });
    }

    // Verify user has access to this meeting
    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, message: access.error.message });
    }

    // Find note
    const note = await PersonalNote.findOne({ userId, meetingId });
    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    // Verify ownership
    if (note.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not own this note",
      });
    }

    // Delete note document atomically
    await PersonalNote.deleteOne({ _id: note._id });

    res.status(200).json({
      success: true,
      message: "Note deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting personal note:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Export constants for use in other modules
export const NOTE_LIMITS = {
  MAX_TITLE_LENGTH: MAX_NOTE_TITLE_LENGTH,
  MAX_CONTENT_LENGTH: MAX_NOTE_CONTENT_LENGTH,
  MAX_ANNOTATION_TEXT_LENGTH: MAX_ANNOTATION_TEXT_LENGTH,
};
