import mongoose from "mongoose";

const meetingAttendanceSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // Null for guests
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["invited", "checked_in", "no_show", "excused"],
      default: "invited",
    },
    joinTime: {
      type: Date,
      default: null,
    },
    leaveTime: {
      type: Date,
      default: null,
    },
    lateMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    earlyLeaveMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

// Compound index to ensure one attendance record per email per meeting
meetingAttendanceSchema.index({ meetingId: 1, email: 1 }, { unique: true });
meetingAttendanceSchema.index({ meetingId: 1, status: 1 });

const MeetingAttendance = mongoose.model(
  "MeetingAttendance",
  meetingAttendanceSchema,
);
export default MeetingAttendance;
