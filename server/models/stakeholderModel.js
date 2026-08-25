import mongoose from 'mongoose';

const interactionSchema = new mongoose.Schema({
    meetingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meeting'
    },
    date: {
        type: Date,
        default: Date.now
    },
    sentimentScore: {
        type: Number, // -1 to 1
        default: 0
    },
    engagementLevel: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    notes: String
});

const stakeholderSchema = new mongoose.Schema(
    {
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            trim: true,
            lowercase: true
        },
        company: {
            type: String,
            trim: true
        },
        role: {
            type: String,
            trim: true
        },
        category: {
            type: String,
            enum: ['client', 'vendor', 'partner', 'investor', 'regulator', 'advisor'],
            default: 'client'
        },
        relationshipHealth: {
            type: Number, // 0-100 composite score
            default: 50
        },
        tier: {
            type: String,
            enum: ['strategic', 'key', 'standard', 'inactive'],
            default: 'standard'
        },
        accountManager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        totalMeetings: {
            type: Number,
            default: 0
        },
        lastInteraction: {
            type: Date
        },
        interactions: [interactionSchema],
        tags: [String],
        riskLevel: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'low'
        },
        avatar: String
    },
    { timestamps: true }
);

// Compute relationship health whenever interactions are updated
stakeholderSchema.pre('save', function (next) {
    if (this.interactions && this.interactions.length > 0) {
        const recent = this.interactions.slice(-10); // last 10
        const avgSentiment = recent.reduce((sum, i) => sum + (i.sentimentScore || 0), 0) / recent.length;
        const highEngagements = recent.filter(i => i.engagementLevel === 'high').length;

        // Normalize to 0–100
        const sentimentComponent = ((avgSentiment + 1) / 2) * 60; // 60% weight
        const engagementComponent = (highEngagements / recent.length) * 40; // 40% weight
        this.relationshipHealth = Math.round(sentimentComponent + engagementComponent);

        // Update last interaction date
        const sorted = [...this.interactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        this.lastInteraction = sorted[0].date;

        // Auto-assess risk based on health score
        if (this.relationshipHealth < 25) this.riskLevel = 'critical';
        else if (this.relationshipHealth < 50) this.riskLevel = 'high';
        else if (this.relationshipHealth < 75) this.riskLevel = 'medium';
        else this.riskLevel = 'low';
    }
    next();
});

export default mongoose.model('Stakeholder', stakeholderSchema);
