import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
  {
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // user must be logged in
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
    description: {
      type: String, // Meeting description/objective
      default: "",
    },
    meetingType: {
      type: String, // conference, policy, event, internal
      enum: ["conference", "policy", "event", "internal"],
      default: "conference",
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String, // Meeting time (e.g., "14:30")
      default: "",
    },
    duration: {
      type: Number, // Duration in minutes
      default: null,
    },
    location: {
      type: String, // Location/platform (e.g., "Zoom", "Conference Room A")
      default: "",
    },
    venue: {
      type: String, // Venue details (physical address or meeting link)
      default: "",
    },
    participants: [
      {
        name: { type: String, required: true },
        email: { type: String, default: "" },
        role: { type: String, default: "" },
      },
    ],
    agendaItems: [
      {
        text: { type: String, required: true },
      },
    ],
    policyDetails: {
      // For policy-type meetings
      policyName: { type: String, default: "" },
      policyVersion: { type: String, default: "" },
      effectiveDate: { type: Date, default: null },
      approvalRequired: { type: Boolean, default: false },
    },
    recordingType: {
      type: String, // "upload" or "live"
      enum: ["upload", "live"],
      default: "upload",
    },
    fileUrl: {
      type: String, // Path or cloud link to uploaded audio/video file
      default: "",
    },
    transcript: {
      type: String, // Raw transcript text from AssemblyAI
      default: "",
    },
    summary: {
      type: String, // Human-readable MoM text
      default: "",
    },
    structuredMoM: {
      type: mongoose.Schema.Types.Mixed, // Structured JSON (title, decisions[], action_items[], attendees[])
      default: null,
    },
    aiNotes: {
      type: String, // Optional - additional AI notes
      default: "",
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