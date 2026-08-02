import PersonalNote from "../models/personalNoteModel.js";

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
    const { content } = req.body;

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
    const { annotationText, sourceField, offsets, color } = req.body;

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
