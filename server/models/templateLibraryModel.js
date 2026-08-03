import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

const templateLibrarySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    originalTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MeetingTemplate",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      default: "General",
      trim: true,
    },
    defaultDuration: {
      type: Number,
      default: 30, // in minutes
    },
    agendaBlocks: [
      {
        title: { type: String, required: true },
        description: { type: String, default: "" },
        duration: { type: Number, default: 15 }, // in minutes
      },
    ],
    defaultParticipants: [
      {
        type: String,
        trim: true,
      },
    ],
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cloneCount: {
      type: Number,
      default: 0,
    },
    ratings: [ratingSchema],
    averageRating: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Method to calculate average rating
templateLibrarySchema.methods.calculateAverageRating = function () {
  if (this.ratings.length === 0) {
    this.averageRating = 0;
  } else {
    const sum = this.ratings.reduce((acc, curr) => acc + curr.rating, 0);
    this.averageRating = sum / this.ratings.length;
  }
};

templateLibrarySchema.index({ organizationId: 1, category: 1 });
templateLibrarySchema.index({ organizationId: 1, averageRating: -1 });
templateLibrarySchema.index({ organizationId: 1, cloneCount: -1 });

const TemplateLibrary = mongoose.model(
  "TemplateLibrary",
  templateLibrarySchema,
);

export default TemplateLibrary;
