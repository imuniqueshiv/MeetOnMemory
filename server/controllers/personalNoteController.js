import mongoose from "mongoose";
import { z } from "zod";
import PersonalNote from "../models/personalNoteModel.js";
import Meeting from "../models/meetingModel.js";

const MAX_CONTENT_LENGTH = 50000;
const MAX_ANNOTATION_LENGTH = 5000;

const noteContentSchema = z.object({
  content: z
    .string()
    .max(
      MAX_CONTENT_LENGTH,
      `Content must be at most ${MAX_CONTENT_LENGTH} characters`,
    )
    .optional(),
});

const annotationSchema = z.object({
  annotationText: z
    .string()
    .max(
      MAX_ANNOTATION_LENGTH,
      `Annotation must be at most ${MAX_ANNOTATION_LENGTH} characters`,
    )
    .optional(),
  sourceField: z.string().optional(),
  offsets: z.any().optional(),
  color: z.string().optional(),
});

// Verify the caller may attach personal notes to meetingId. Returns
// { meeting } on success or { error: { status, message } } otherwise.
async function resolveAccessibleMeeting(meetingId, user) {
  if (!mongoose.isValidObjectId(meetingId)) {
    return { error: { status: 400, message: "Invalid meeting ID" } };
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    return { error: { status: 404, message: "Meeting not found" } };
  }

  const userId = user._id.toString();
  const isOwner = meeting.uploadedBy?.toString() === userId;
  const isParticipant = meeting.participants?.some(
    (p) => p.user?.toString() === userId,
  );
  const sameOrg =
    meeting.organization &&
    user.organization &&
    meeting.organization.toString() === user.organization.toString();

  if (!isOwner && !isParticipant && !sameOrg) {
    return {
      error: {
        status: 403,
        message: "Not authorized to add notes for this meeting",
      },
    };
  }

  return { meeting };
}

// @desc    Get personal note for a specific meeting
// @route   GET /api/personal-notes/:meetingId
// @access  Private
export const getNoteByMeetingId = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    let note = await PersonalNote.findOne({ userId, meetingId });

    if (!note) {
      // Return empty structure so client doesn't get 404
      return res.status(200).json({
        success: true,
        note: {
          content: "",
          annotations: [],
          isPinned: false,
        },
      });
    }

    res.status(200).json({
      success: true,
      note,
    });
  } catch (error) {
    console.error("Error fetching personal note:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Upsert personal note content
// @route   POST /api/personal-notes/:meetingId
// @access  Private
export const upsertNote = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, message: access.error.message });
    }

    const parsed = noteContentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, message: parsed.error.issues[0].message });
    }
    const content = parsed.data.content ?? "";

    let note = await PersonalNote.findOne({ userId, meetingId });

    if (note) {
      note.content = content;
      await note.save();
    } else {
      note = await PersonalNote.create({
        userId,
        meetingId,
        content,
      });
    }

    res.status(200).json({
      success: true,
      note,
    });
  } catch (error) {
    console.error("Error upserting personal note:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Add an annotation to a personal note
// @route   POST /api/personal-notes/:meetingId/annotations
// @access  Private
export const addAnnotation = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, message: access.error.message });
    }

    const parsed = annotationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, message: parsed.error.issues[0].message });
    }
    const { annotationText, sourceField, offsets, color } = parsed.data;

    let note = await PersonalNote.findOne({ userId, meetingId });

    if (!note) {
      note = await PersonalNote.create({
        userId,
        meetingId,
        content: "",
      });
    }

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
    });
  } catch (error) {
    console.error("Error adding annotation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Remove an annotation from a personal note
// @route   DELETE /api/personal-notes/:meetingId/annotations/:annotationId
// @access  Private
export const removeAnnotation = async (req, res) => {
  try {
    const { meetingId, annotationId } = req.params;
    const userId = req.user._id;

    const note = await PersonalNote.findOne({ userId, meetingId });

    if (!note) {
      return res
        .status(404)
        .json({ success: false, message: "Note not found" });
    }

    note.annotations = note.annotations.filter(
      (a) => a._id.toString() !== annotationId,
    );

    await note.save();

    res.status(200).json({
      success: true,
      note,
    });
  } catch (error) {
    console.error("Error removing annotation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Toggle pin status of a personal note
// @route   PATCH /api/personal-notes/:meetingId/pin
// @access  Private
export const togglePin = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;
    const { isPinned } = req.body;

    const access = await resolveAccessibleMeeting(meetingId, req.user);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ success: false, message: access.error.message });
    }

    let note = await PersonalNote.findOne({ userId, meetingId });

    if (!note) {
      note = await PersonalNote.create({
        userId,
        meetingId,
        content: "",
        isPinned,
      });
    } else {
      note.isPinned = isPinned;
      await note.save();
    }

    res.status(200).json({
      success: true,
      note,
    });
  } catch (error) {
    console.error("Error toggling pin:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get all pinned personal notes for the current user
// @route   GET /api/personal-notes/pinned
// @access  Private
export const getPinnedNotes = async (req, res) => {
  try {
    const userId = req.user._id;
    const notes = await PersonalNote.find({ userId, isPinned: true })
      .populate("meetingId", "title date")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      notes,
    });
  } catch (error) {
    console.error("Error fetching pinned notes:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Search personal notes for the current user
// @route   GET /api/personal-notes/search
// @access  Private
export const searchNotes = async (req, res) => {
  try {
    const userId = req.user._id;
    const { q } = req.query;

    if (!q) {
      return res
        .status(400)
        .json({ success: false, message: "Search query required" });
    }

    const notes = await PersonalNote.find(
      {
        userId,
        $text: { $search: q },
      },
      { score: { $meta: "textScore" } },
    )
      .sort({ score: { $meta: "textScore" } })
      .populate("meetingId", "title date");

    res.status(200).json({
      success: true,
      notes,
    });
  } catch (error) {
    console.error("Error searching notes:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
