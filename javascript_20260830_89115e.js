import mongoose from 'mongoose';

const icebreakerSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'fun_fact',
        'would_you_rather',
        'two_truths_one_lie',
        'icebreaker_question',
        'word_association',
        'quick_poll',
        'brain_teaser',
      ],
      default: 'icebreaker_question',
    },
    question: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 500,
    },
    options: {
      type: [String],
      validate: {
        validator: function (options) {
          // If it's a poll type, require at least 2 options
          if (this.type === 'quick_poll' && (!options || options.length < 2)) {
            return false;
          }
          // Other types may have options but are optional
          return true;
        },
        message: 'Quick poll requires at least 2 options',
      },
    },
    correctAnswer: {
      type: String,
      trim: true,
    },
    responses: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        answer: {
          type: mongoose.Schema.Types.Mixed,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    generatedBy: {
      type: String,
      enum: ['ai', 'manual', 'system'],
      default: 'ai',
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'answered', 'expired', 'archived'],
      default: 'draft',
    },
    displayDuration: {
      type: Number,
      default: 60, // seconds
      min: 5,
      max: 300,
    },
    scheduledAt: {
      type: Date,
    },
    displayedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    tags: {
      type: [String],
      default: [],
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
icebreakerSchema.index({ meetingId: 1, status: 1 });
icebreakerSchema.index({ organizationId: 1, createdAt: -1 });
icebreakerSchema.index({ scheduledAt: 1, status: 1 });

// Virtual for response count
icebreakerSchema.virtual('responseCount').get(function () {
  return this.responses ? this.responses.length : 0;
});

// Method to check if user has responded
icebreakerSchema.methods.hasUserResponded = function (userId) {
  if (!this.responses) return false;
  return this.responses.some((r) => r.userId.toString() === userId.toString());
};

// Method to add a response
icebreakerSchema.methods.addResponse = function (userId, answer) {
  if (this.hasUserResponded(userId)) {
    // Update existing response
    const existing = this.responses.find(
      (r) => r.userId.toString() === userId.toString()
    );
    existing.answer = answer;
    existing.timestamp = new Date();
  } else {
    this.responses.push({ userId, answer, timestamp: new Date() });
  }
  return this;
};

// Static method to get active icebreaker for meeting
icebreakerSchema.statics.getActiveForMeeting = async function (meetingId) {
  return this.findOne({
    meetingId,
    status: 'active',
    expiresAt: { $gt: new Date() },
  }).sort({ displayedAt: -1 });
};

// Static method to get meeting statistics
icebreakerSchema.statics.getMeetingStats = async function (meetingId) {
  const stats = await this.aggregate([
    { $match: { meetingId: mongoose.Types.ObjectId(meetingId) } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        avgResponses: { $avg: { $size: '$responses' } },
        totalResponses: { $sum: { $size: '$responses' } },
      },
    },
  ]);
  return stats;
};

// Pre-save middleware to set expiresAt
icebreakerSchema.pre('save', function (next) {
  if (this.status === 'active' && !this.expiresAt) {
    const duration = this.displayDuration || 60;
    this.expiresAt = new Date(Date.now() + duration * 1000);
  }
  next();
});

const Icebreaker = mongoose.model('Icebreaker', icebreakerSchema);

export default Icebreaker;