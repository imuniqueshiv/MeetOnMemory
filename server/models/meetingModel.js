import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
  {
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // ✅ Required field (renamed from user)
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    fileUrl: {
      type: String, // Path or cloud link to uploaded audio/video file
    },
    transcript: {
      type: String, // Raw transcript text
    },
    summary: {
      type: String, // AI-generated summary (Minutes of Meeting)
    },
    aiNotes: {
      type: String, // Optional - additional AI notes (e.g., key decisions)
    },
    duration: {
      type: Number, // in seconds (optional)
    },
    status: {
      type: String,
      enum: ["uploaded", "processing", "completed", "failed"],
      default: "uploaded",
    },
    tags: [String], // e.g., ["policy", "finance", "staff"]
  },
  { timestamps: true }
);

const Meeting = mongoose.model("Meeting", meetingSchema);
export default Meeting;
