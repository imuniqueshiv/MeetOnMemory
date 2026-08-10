import mongoose from "mongoose";

/**
 * QualityBenchmark Schema
 * Stores benchmark data for comparing meeting quality across
 * teams, individuals, industries, and meeting types
 */

const benchmarkAveragesSchema = new mongoose.Schema(
  {
    participation: { type: Number, default: 0, min: 0, max: 100 },
    decision: { type: Number, default: 0, min: 0, max: 100 },
    efficiency: { type: Number, default: 0, min: 0, max: 100 },
    followThrough: { type: Number, default: 0, min: 0, max: 100 },
    satisfaction: { type: Number, default: 0, min: 0, max: 100 },
    overall: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false },
);

const benchmarkPercentilesSchema = new mongoose.Schema(
  {
    p10: { type: Number, default: 0 },
    p25: { type: Number, default: 0 },
    p50: { type: Number, default: 0, description: "Median" },
    p75: { type: Number, default: 0 },
    p90: { type: Number, default: 0 },
    p95: { type: Number, default: 0 },
  },
  { _id: false },
);

const benchmarkStdDevSchema = new mongoose.Schema(
  {
    participation: { type: Number, default: 0 },
    decision: { type: Number, default: 0 },
    efficiency: { type: Number, default: 0 },
    followThrough: { type: Number, default: 0 },
    satisfaction: { type: Number, default: 0 },
    overall: { type: Number, default: 0 },
  },
  { _id: false },
);

const qualityBenchmarkSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "organization",
        "team",
        "individual",
        "industry",
        "meeting-type",
        "time-period",
      ],
      required: true,
      index: true,
    },
    entity: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "entityModel",
      default: null,
      description: "Team/individual ID for specific benchmarks",
    },
    entityModel: {
      type: String,
      enum: ["User", "Team", "Organization", "Meeting"],
      default: "Organization",
    },
    entityType: {
      type: String,
      description: "Additional identifier (e.g., meeting type)",
    },
    period: {
      type: String,
      enum: ["daily", "weekly", "monthly", "quarterly", "yearly", "all-time"],
      default: "monthly",
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    averages: {
      type: benchmarkAveragesSchema,
      default: () => ({}),
    },
    percentiles: {
      type: benchmarkPercentilesSchema,
      default: () => ({}),
    },
    stdDev: {
      type: benchmarkStdDevSchema,
      default: () => ({}),
    },
    sampleSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    topPerformers: [
      {
        entityId: mongoose.Schema.Types.ObjectId,
        entityName: String,
        score: Number,
        rank: Number,
      },
    ],
    trends: {
      direction: {
        type: String,
        enum: ["improving", "stable", "declining"],
        default: "stable",
      },
      changePercentage: {
        type: Number,
        default: 0,
      },
      previousPeriodAverage: {
        type: Number,
        default: 0,
      },
    },
    updatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for efficient queries
qualityBenchmarkSchema.index(
  { organization: 1, type: 1, period: 1 },
  { unique: false },
);
qualityBenchmarkSchema.index({ organization: 1, entity: 1, type: 1 });
qualityBenchmarkSchema.index({ updatedAt: -1 });
qualityBenchmarkSchema.index({ periodEnd: -1 });

// Static method to get organization benchmark
qualityBenchmarkSchema.statics.getOrganizationBenchmark = function (
  orgId,
  period = "monthly",
) {
  return this.findOne({
    organization: orgId,
    type: "organization",
    period,
    isActive: true,
  }).sort({ updatedAt: -1 });
};

// Static method to get meeting type benchmark
qualityBenchmarkSchema.statics.getTypeBenchmark = function (
  orgId,
  meetingType,
  period = "monthly",
) {
  return this.findOne({
    organization: orgId,
    type: "meeting-type",
    entityType: meetingType,
    period,
    isActive: true,
  }).sort({ updatedAt: -1 });
};

// Static method to get individual benchmark
qualityBenchmarkSchema.statics.getIndividualBenchmark = function (
  orgId,
  userId,
  period = "monthly",
) {
  return this.findOne({
    organization: orgId,
    type: "individual",
    entity: userId,
    period,
    isActive: true,
  }).sort({ updatedAt: -1 });
};

const QualityBenchmark = mongoose.model(
  "QualityBenchmark",
  qualityBenchmarkSchema,
);

export default QualityBenchmark;
