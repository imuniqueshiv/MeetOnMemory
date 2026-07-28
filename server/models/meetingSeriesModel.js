import mongoose from "mongoose";

const meetingSeriesSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recurrencePattern: {
      type: String,
      enum: ["daily", "weekly", "biweekly", "monthly"],
      required: true,
    },
    dayOfWeek: {
      type: Number, // 0 (Sunday) to 6 (Saturday)
      default: null,
    },
    dayOfMonth: {
      type: Number, // 1 to 31
      default: null,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

meetingSeriesSchema.index({ organization: 1 });
meetingSeriesSchema.index({ createdBy: 1 });

const MeetingSeries = mongoose.model("MeetingSeries", meetingSeriesSchema);
export default MeetingSeries;
