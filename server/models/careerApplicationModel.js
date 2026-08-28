import mongoose from "mongoose";

const COVER_LETTER_MAX_LENGTH = 2000;

const careerApplicationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    jobId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    jobTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    portfolio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    coverLetter: {
      type: String,
      trim: true,
      maxlength: COVER_LETTER_MAX_LENGTH,
      default: "",
    },
    resume: {
      originalName: { type: String, required: true },
      storedName: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: [
        "received",
        "pending",
        "reviewing",
        "interview_scheduled",
        "rejected",
        "accepted",
      ],
      default: "received",
    },
    adminNotes: {
      type: String,
      default: "",
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

careerApplicationSchema.index({ email: 1, jobId: 1 }, { unique: true });

export const CAREER_COVER_LETTER_MAX_LENGTH = COVER_LETTER_MAX_LENGTH;

export default mongoose.model("CareerApplication", careerApplicationSchema);
