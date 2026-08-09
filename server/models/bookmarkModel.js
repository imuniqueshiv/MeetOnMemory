import mongoose from "mongoose";

const bookmarkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    collectionName: {
      type: String,
      default: "Uncategorized",
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      default: "#3b82f6", // Default tailwind blue-500
    },
  },
  { timestamps: true },
);

// Ensure a user can only bookmark a specific meeting once
bookmarkSchema.index({ user: 1, meeting: 1 }, { unique: true });

const Bookmark = mongoose.model("Bookmark", bookmarkSchema);

export default Bookmark;
