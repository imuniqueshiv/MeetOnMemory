import mongoose from 'mongoose';

const citationSchema = new mongoose.Schema({
    referenceType: {
        type: String, // 'prior_art', 'internal_doc', 'meeting_clip'
        required: true
    },
    referenceUrl: String,
    description: String
});

const ipVaultSchema = new mongoose.Schema(
    {
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true
        },
        conceptName: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            required: true
        },
        patentabilityScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 50
        },
        originMeetingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Meeting'
        },
        inventors: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        status: {
            type: String,
            enum: ['identified', 'under_review', 'filed', 'granted', 'abandoned'],
            default: 'identified'
        },
        techDomain: {
            type: String,
            enum: ['software', 'hardware', 'business_method', 'design', 'other'],
            default: 'software'
        },
        citations: [citationSchema],
        filingDate: {
            type: Date
        },
        tags: [String]
    },
    { timestamps: true }
);

export default mongoose.model('IpVault', ipVaultSchema);
