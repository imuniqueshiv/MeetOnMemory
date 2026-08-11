import Bookmark from "../models/bookmarkModel.js";
import Meeting from "../models/meetingModel.js";
import mongoose from "mongoose";
import { isSameOrganization } from "../utils/authUtils.js";

// @desc    Toggle bookmark (add if missing, remove if exists)
// @route   POST /api/bookmarks/toggle
// @access  Private
export const toggleBookmark = async (req, res) => {
  try {
    const { meetingId, collectionName, notes, color } = req.body;
    const userId = req.user._id;

    if (!meetingId) {
      return res.status(400).json({ message: "meetingId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return res.status(400).json({ message: "Invalid meetingId" });
    }

    // Validate meeting existence and organization ownership
    const meeting =
      await Meeting.findById(meetingId).select("organization _id");
    if (!meeting) {
      // Allow removing existing bookmarks of deleted meetings
      const existingBookmark = await Bookmark.findOne({
        user: userId,
        meeting: meetingId,
      });
      if (existingBookmark) {
        await Bookmark.deleteOne({ _id: existingBookmark._id });
        return res
          .status(200)
          .json({ message: "Bookmark removed", bookmarked: false });
      }
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (!isSameOrganization(req.user, meeting)) {
      return res.status(403).json({
        message: "Meeting does not belong to your organization",
      });
    }

    const existingBookmark = await Bookmark.findOne({
      user: userId,
      meeting: meetingId,
    });

    if (existingBookmark) {
      // If it exists, remove it (toggle off)
      await Bookmark.deleteOne({ _id: existingBookmark._id });
      return res
        .status(200)
        .json({ message: "Bookmark removed", bookmarked: false });
    } else {
      // If it doesn't exist, create it (toggle on)
      const newBookmark = await Bookmark.create({
        user: userId,
        meeting: meetingId,
        collectionName: collectionName || "Uncategorized",
        notes: notes || "",
        color: color || "#3b82f6",
      });
      return res.status(201).json({
        message: "Bookmark added",
        bookmarked: true,
        data: newBookmark,
      });
    }
  } catch (error) {
    console.error("Error in toggleBookmark:", error);
    res.status(500).json({ message: "Server error toggling bookmark" });
  }
};

// @desc    Get all bookmarks for user
// @route   GET /api/bookmarks
// @access  Private
export const getBookmarks = async (req, res) => {
  try {
    const userId = req.user._id;
    const { collectionName } = req.query;

    const query = { user: userId };
    if (collectionName) {
      query.collectionName = String(collectionName);
    }

    const bookmarks = await Bookmark.find(query).sort({ createdAt: -1 });

    // Store raw meeting IDs before populate replaces them with null on delete
    const rawMeetingIds = new Map();
    bookmarks.forEach((b) => {
      if (b.meeting) {
        rawMeetingIds.set(b._id.toString(), b.meeting.toString());
      }
    });

    await Bookmark.populate(bookmarks, {
      path: "meeting",
      select: "title date time duration _id",
    });

    const responseData = bookmarks.map((b) => {
      const obj = b.toObject();
      obj.rawMeetingId = rawMeetingIds.get(b._id.toString()) || null;
      return obj;
    });

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error in getBookmarks:", error);
    res.status(500).json({ message: "Server error fetching bookmarks" });
  }
};

// @desc    Get distinct collections and counts for user
// @route   GET /api/bookmarks/collections
// @access  Private
export const getCollections = async (req, res) => {
  try {
    const userId = req.user._id;

    const collections = await Bookmark.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$collectionName",
          count: { $sum: 1 },
          color: { $first: "$color" },
        },
      },
      { $project: { name: "$_id", count: 1, color: 1, _id: 0 } },
      { $sort: { name: 1 } },
    ]);

    res.status(200).json(collections);
  } catch (error) {
    console.error("Error in getCollections:", error);
    res.status(500).json({ message: "Server error fetching collections" });
  }
};

// @desc    Update bookmark details (notes, collectionName, color)
// @route   PUT /api/bookmarks/:id
// @access  Private
export const updateBookmark = async (req, res) => {
  try {
    const { collectionName, notes, color } = req.body;
    const bookmark = await Bookmark.findOne({
      _id: String(req.params.id),
      user: req.user._id,
    });

    if (!bookmark) {
      return res.status(404).json({ message: "Bookmark not found" });
    }

    if (collectionName !== undefined) bookmark.collectionName = collectionName;
    if (notes !== undefined) bookmark.notes = notes;
    if (color !== undefined) bookmark.color = color;

    const updatedBookmark = await bookmark.save();
    res.status(200).json(updatedBookmark);
  } catch (error) {
    console.error("Error in updateBookmark:", error);
    res.status(500).json({ message: "Server error updating bookmark" });
  }
};

// @desc    Delete all bookmarks in a collection
// @route   DELETE /api/bookmarks/collections/:name
// @access  Private
export const deleteCollection = async (req, res) => {
  try {
    const userId = req.user._id;
    const collectionName = String(req.params.name);

    await Bookmark.deleteMany({ user: userId, collectionName });
    res.status(200).json({ message: `Collection ${collectionName} deleted` });
  } catch (error) {
    console.error("Error in deleteCollection:", error);
    res.status(500).json({ message: "Server error deleting collection" });
  }
};
