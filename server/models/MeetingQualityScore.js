import mongoose from "mongoose";

/**
 * MeetingQualityScore Schema
 * Stores multi-dimensional quality scores for meetings with insights,
 * badges, and comprehensive metrics for benchmarking
 */

const dimensionScoreSchema = new mongoose.Schema(
  {
    participation: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      description: "Equity of participation and engagement level",
    },
    decision: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      description: "Decision density, clarity, and actionability",
    },
    efficiency: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      description: "Meeting length vs outcomes and focus",
    },
    followThrough: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      description: "Action item completion rate",
    },
    satisfaction: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      description: "Participant feedback ratings",
    },
    overall: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      description: "Weighted average of all dimensions",
    },
  },
  { _id: false },
);

const metricSchema = new mongoose.Schema(
  {
    participantCount: { type: Number, default: 0 },
    duration: { type: Number, default: 0, description: "Duration in minutes" },
    decisionCount: { type: Number, default: 0 },
    actionItemCount: { type: Number, default: 0 },
    actionItemCompletionRate: { type: Number, default: 0, min: 0, max: 100 },
    silencePeriods: { type: Number, default: 0 },
    participationEquity: { type: Number, default: 0, min: 0, max: 100 },
    avgInterventionLength: { type: Number, default: 0 },
    speakerCount: { type: Number, default: 0 },
    agendaItemsCovered: { type: Number, default: 0 },
    offTopicTime: {
      type: Number,
      default: 0,
      description: "Minutes spent off-topic",
    },
  },
  { _id: false },
);

const insightSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "strength",
        "weakness",
        "recommendation",
        "observation",
        "anomaly",
      ],
      required: true,
    },
    category: {
      type: String,
      enum: [
        "participation",
        "decision-making",
        "efficiency",
        "follow-through",
        "satisfaction",
        "engagement",
        "collaboration",
      ],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    impact: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },
    actionable: {
      type: Boolean,
      default: false,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8,
    },
    relatedMetric: {
      type: String,
      description: "Metric this insight is based on",
    },
  },
  { _id: false },
);

const badgeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: [
        "Excellent Meeting",
        "Top Performer",
        "Decision Maker",
        "Efficiency Expert",
        "Team Player",
        "Follow-Through Champion",
        "Engagement Leader",
        "Perfect Score",
        "Consistency King",
        "Improvement Star",
      ],
    },
    icon: {
      type: String,
      default: "🏆",
    },
    description: {
      type: String,
      default: "",
    },
    earnedAt: {
      type: Date,
      default: Date.now,
    },
    rarity: {
      type: String,
      enum: ["common", "uncommon", "rare", "epic", "legendary"],
      default: "common",
    },
  },
  { _id: false },
);

const meetingQualityScoreSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
      unique: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    meetingType: {
      type: String,
      enum: [
        "conference",
        "policy",
        "event",
        "internal",
        "external",
        "board",
        "standup",
        "1on1",
      ],
      default: "conference",
      index: true,
    },
    scores: {
      type: dimensionScoreSchema,
      default: () => ({}),
    },
    metrics: {
      type: metricSchema,
      default: () => ({}),
    },
    insights: {
      type: [insightSchema],
      default: [],
    },
    badges: {
      type: [badgeSchema],
      default: [],
    },
    recommendations: {
      type: [String],
      default: [],
    },
    benchmarkComparison: {
      overallPercentile: { type: Number, min: 0, max: 100, default: 50 },
      categoryRanking: { type: Number, default: 0 },
      vsOrgAverage: {
        type: Number,
        default: 0,
        description: "Points above/below org average",
      },
      vsTypeAverage: {
        type: Number,
        default: 0,
        description: "Points above/below type average",
      },
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    calculationVersion: {
      type: String,
      default: "1.0",
    },
    status: {
      type: String,
      enum: ["pending", "calculating", "completed", "failed"],
      default: "pending",
    },
    error: {
      type: String,
      trim: true,
    },
    recalculationCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient queries
meetingQualityScoreSchema.index({ organization: 1, calculatedAt: -1 });
meetingQualityScoreSchema.index({ organization: 1, "scores.overall": -1 });
meetingQualityScoreSchema.index({ meetingType: 1, "scores.overall": -1 });
meetingQualityScoreSchema.index({
  "benchmarkComparison.overallPercentile": -1,
});

// Virtual for quality tier
meetingQualityScoreSchema.virtual("qualityTier").get(function () {
  const score = this.scores?.overall || 0;
  if (score >= 90) return "exceptional";
  if (score >= 75) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "average";
  return "needs-improvement";
});

// Virtual for tier color
meetingQualityScoreSchema.virtual("tierColor").get(function () {
  const tier = this.qualityTier;
  const colors = {
    exceptional: "#10b981",
    excellent: "#3b82f6",
    good: "#8b5cf6",
    average: "#f59e0b",
    "needs-improvement": "#ef4444",
  };
  return colors[tier] || "#6b7280";
});

// Method to add badge
meetingQualityScoreSchema.methods.addBadge = function (badge) {
  const exists = this.badges.find((b) => b.name === badge.name);
  if (!exists) {
    this.badges.push(badge);
  }
  return this.save();
};

// Method to add insight
meetingQualityScoreSchema.methods.addInsight = function (insight) {
  this.insights.push(insight);
  return this.save();
};

const MeetingQualityScore = mongoose.model(
  "MeetingQualityScore",
  meetingQualityScoreSchema,
);

export default MeetingQualityScore;
