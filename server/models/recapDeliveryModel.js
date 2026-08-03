import mongoose from "mongoose";

const recapDeliverySchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deliveredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// Prevent duplicate deliveries for the same meeting to the same user
recapDeliverySchema.index({ meetingId: 1, userId: 1 }, { unique: true });

export default mongoose.model("RecapDelivery", recapDeliverySchema);
