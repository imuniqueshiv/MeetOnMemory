import mongoose from "mongoose";

const calendarIntegrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    provider: {
      type: String,
      enum: ["google", "outlook"],
      required: true,
    },
    accessToken: {
      type: String, // encrypted
      required: true,
    },
    refreshToken: {
      type: String, // encrypted
      default: "",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    externalCalendarId: {
      type: String,
      default: "primary", // can be primary for Google or specific calendar ID
    },
    syncEnabled: {
      type: Boolean,
      default: true,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Prevent a user from having multiple active integrations for the same provider
calendarIntegrationSchema.index({ userId: 1, provider: 1 }, { unique: true });

const CalendarIntegration = mongoose.model(
  "CalendarIntegration",
  calendarIntegrationSchema,
);
export default CalendarIntegration;
