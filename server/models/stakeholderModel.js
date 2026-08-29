import mongoose from 'mongoose';

const interactionSchema = new mongoose.Schema({
    meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
    type: {
        type: String,
        enum: ['meeting', 'email', 'call', 'note', 'follow_up'],
        default: 'meeting'
    },
    date: { type: Date, default: Date.now },
    sentiment: {
        type: Number,
        min: -1,
        max: 1,
        default: 0
    },
    engagement: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
    },
    summary: { type: String, trim: true },
    actionItems: [{ type: String, trim: true }],
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const stakeholderSchema = new mongoose.Schema(
    {
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true
        },
        name: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true },
        company: { type: String, trim: true },
        category: {
            type: String,
            enum: ['client', 'vendor', 'partner', 'investor'],
            required: true
        },
        tier: {
            type: String,
            enum: ['strategic', 'operational', 'tactical'],
            default: 'operational'
        },
        primaryContact: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        interactions: [interactionSchema],
        totalMeetingsAttended: { type: Number, default: 0 },
        lastInteractionDate: { type: Date },
        healthScore: { type: Number, default: 50 },
        riskLevel: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        },
        notes: { type: String, trim: true },
        tags: [String],
        status: {
            type: String,
            enum: ['active', 'inactive', 'churned'],
            default: 'active'
        }
    },
    { timestamps: true }
);

// Auto-compute health score and risk level on every save
stakeholderSchema.pre('save', function (next) {
    let score = 50; // baseline

    const interactions = this.interactions || [];
    if (interactions.length > 0) {
        // Average sentiment across all interactions (-1 to 1 → scale to -25 to +25)
        const avgSentiment = interactions.reduce((sum, i) => sum + (i.sentiment || 0), 0) / interactions.length;
        score += avgSentiment * 25;

        // Average engagement (0-100 → scale to -25 to +25)
        const avgEngagement = interactions.reduce((sum, i) => sum + (i.engagement || 0), 0) / interactions.length;
        score += ((avgEngagement - 50) / 50) * 25;

        // Recency bonus: interactions in last 30 days add up to +15
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentCount = interactions.filter(i => new Date(i.date) > thirtyDaysAgo).length;
        score += Math.min(recentCount * 5, 15);

        // Interaction volume bonus: more interactions = stronger relationship
        score += Math.min(interactions.length * 2, 10);
    } else {
        // No interactions → penalize
        score -= 15;
    }

    this.healthScore = Math.max(0, Math.min(100, Math.round(score)));

    // Auto-assign risk level based on health score
    if (this.healthScore >= 70) {
        this.riskLevel = 'low';
    } else if (this.healthScore >= 45) {
        this.riskLevel = 'medium';
    } else if (this.healthScore >= 20) {
        this.riskLevel = 'high';
    } else {
        this.riskLevel = 'critical';
    }

    next();
});

export default mongoose.model('Stakeholder', stakeholderSchema);
