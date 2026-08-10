import mongoose from "mongoose";

/**
 * MeetingAnalytics Schema
 * Stores comprehensive analytics data for meeting recordings including
 * speaker participation, engagement metrics, and AI-generated insights
 */

const speakerAnalyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
  },
  totalTime: {
    type: Number,
    default: 0,
    min: 0,
    description: "Total speaking time in seconds",
  },
  interventionCount: {
    type: Number,
    default: 0,
    min: 0,
    description: "Number of times speaker spoke",
  },
  averageInterventionLength: {
    type: Number,
    default: 0,
    min: 0,
    description: "Average length of each speaking turn in seconds",
  },
  percentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    description: "Percentage of total meeting time",
  },
  dominanceScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    description: "Dominance score (0-100)",
  },
  firstSpokeAt: {
    type: Number,
    description: "Timestamp when speaker first spoke (seconds from start)",
  },
  lastSpokeAt: {
    type: Number,
    description: "Timestamp when speaker last spoke (seconds from start)",
  },
});

const timelineEntrySchema = new mongoose.Schema({
  timestamp: {
    type: Number,
    required: true,
    min: 0,
    description: "Seconds from meeting start",
  },
  speaker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  speakerName: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
    min: 0,
    description: "Duration of speaking turn in seconds",
  },
  text: {
    type: String,
    trim: true,
    description: "Transcript text for this segment",
  },
});

const silencePeriodSchema = new mongoose.Schema({
  startTime: {
    type: Number,
    required: true,
    min: 0,
  },
  endTime: {
    type: Number,
    required: true,
    min: 0,
  },
  duration: {
    type: Number,
    required: true,
    min: 0,
  },
});

const metricsSchema = new mongoose.Schema({
  totalDuration: {
    type: Number,
    default: 0,
    min: 0,
    description: "Total meeting duration in seconds",
  },
  speakerCount: {
    type: Number,
    default: 0,
    min: 0,
    description: "Number of unique speakers",
  },
  participantCount: {
    type: Number,
    default: 0,
    min: 0,
    description: "Total number of participants",
  },
  participationEquity: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    description: "How evenly speaking time is distributed (0-100)",
  },
  silencePeriods: {
    type: Number,
    default: 0,
    min: 0,
    description: "Number of silence periods (>5 seconds)",
  },
  totalSilenceTime: {
    type: Number,
    default: 0,
    min: 0,
    description: "Total silence time in seconds",
  },
  averageInterventionLength: {
    type: Number,
    default: 0,
    min: 0,
    description: "Average speaking turn length in seconds",
  },
  longestIntervention: {
    type: Number,
    default: 0,
    min: 0,
    description: "Longest speaking turn in seconds",
  },
  decisionCount: {
    type: Number,
    default: 0,
    min: 0,
    description: "Number of decisions made",
  },
  decisionDensity: {
    type: Number,
    default: 0,
    min: 0,
    description: "Decisions per hour",
  },
  actionItemCount: {
    type: Number,
    default: 0,
    min: 0,
    description: "Number of action items generated",
  },
  actionItemDensity: {
    type: Number,
    default: 0,
    min: 0,
    description: "Action items per hour",
  },
  engagementScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    description: "Overall engagement score (0-100)",
  },
});

const insightSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["strength", "weakness", "recommendation", "observation"],
    required: true,
  },
  category: {
    type: String,
    enum: [
      "participation",
      "engagement",
      "efficiency",
      "decision-making",
      "collaboration",
    ],
    required: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
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
  relatedMetric: {
    type: String,
    description: "Metric this insight is based on",
  },
});

const meetingAnalyticsSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    speakers: {
      type: [speakerAnalyticsSchema],
      default: [],
    },
    timeline: {
      type: [timelineEntrySchema],
      default: [],
    },
    silencePeriods: {
      type: [silencePeriodSchema],
      default: [],
    },
    metrics: {
      type: metricsSchema,
      default: () => ({}),
    },
    insights: {
      type: [insightSchema],
      default: [],
    },
    analyzedAt: {
      type: Date,
      default: Date.now,
    },
    analysisVersion: {
      type: String,
      default: "1.0",
      description: "Version of analytics algorithm used",
    },
    status: {
      type: String,
      enum: ["pending", "analyzing", "completed", "failed"],
      default: "pending",
    },
    error: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient queries
meetingAnalyticsSchema.index({ meeting: 1 }, { unique: true });
meetingAnalyticsSchema.index({ organization: 1, createdAt: -1 });
meetingAnalyticsSchema.index({ "speakers.userId": 1 });
meetingAnalyticsSchema.index({ analyzedAt: -1 });

// Virtual for dominant speaker
meetingAnalyticsSchema.virtual("dominantSpeaker").get(function () {
  if (!this.speakers || this.speakers.length === 0) return null;
  return this.speakers.reduce((max, speaker) =>
    speaker.totalTime > max.totalTime ? speaker : max,
  );
});

// Virtual for most engaged speaker
meetingAnalyticsSchema.virtual("mostEngagedSpeaker").get(function () {
  if (!this.speakers || this.speakers.length === 0) return null;
  return this.speakers.reduce((max, speaker) =>
    speaker.interventionCount > max.interventionCount ? speaker : max,
  );
});

const MeetingAnalytics = mongoose.model(
  "MeetingAnalytics",
  meetingAnalyticsSchema,
);

export default MeetingAnalytics;
