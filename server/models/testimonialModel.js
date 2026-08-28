import mongoose from "mongoose";

const COMMENT_MAX_LENGTH = 500;

const testimonialSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: COMMENT_MAX_LENGTH,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    moderatedAt: {
      type: Date,
      default: null,
    },
    featuredOnHomepage: {
      type: Boolean,
      default: false,
      index: true,
    },
    spotlightOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

// One active review per user
testimonialSchema.index({ user: 1 }, { unique: true });
testimonialSchema.index({ status: 1, createdAt: -1 });
testimonialSchema.index({
  featuredOnHomepage: 1,
  spotlightOrder: 1,
  createdAt: -1,
});

export const TESTIMONIAL_COMMENT_MAX_LENGTH = COMMENT_MAX_LENGTH;

export default mongoose.model("Testimonial", testimonialSchema);
