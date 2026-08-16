import mongoose from "mongoose";

const mergeLogSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
  primaryMeeting: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting" },
  mergedMeetings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Meeting" }],
  snapshot: { type: mongoose.Schema.Types.Mixed }, // Pre-merge snapshot for rollback
  mergedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: { type: String, enum: ["merged", "rolled_back"], default: "merged" }
}, { timestamps: true });

export default mongoose.models.MeetingMergeLog || mongoose.model("MeetingMergeLog", mergeLogSchema);
