import mongoose from 'mongoose';

const keyResultSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    metric: {
        type: String,
        required: true
    },
    startValue: {
        type: Number,
        default: 0
    },
    targetValue: {
        type: Number,
        required: true
    },
    currentValue: {
        type: Number,
        default: 0
    },
    progress: {
        type: Number, // percentage 0-100
        default: 0
    },
    status: {
        type: String,
        enum: ['on_track', 'at_risk', 'behind', 'completed'],
        default: 'on_track'
    }
});

const okrSchema = new mongoose.Schema(
    {
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true
        },
        objective: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        quarter: {
            type: String,
            required: true // e.g., 'Q3 2026'
        },
        keyResults: [keyResultSchema],
        alignmentScore: {
            type: Number,
            default: 0
        },
        associatedMeetings: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Meeting'
        }],
        totalMeetingHoursLinked: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ['active', 'closed', 'draft'],
            default: 'active'
        },
        tags: [String]
    },
    { timestamps: true }
);

// Auto-calculate progress before saving
okrSchema.pre('save', function (next) {
    if (this.keyResults && this.keyResults.length > 0) {
        let totalProgress = 0;
        this.keyResults.forEach(kr => {
            // Calculate individual KR progress
            const targetDiff = kr.targetValue - kr.startValue;
            const currentDiff = kr.currentValue - kr.startValue;
            if (targetDiff !== 0) {
                kr.progress = Math.min(Math.max((currentDiff / targetDiff) * 100, 0), 100);
            } else {
                kr.progress = 100; // If target is same as start
            }

            // Auto-update status based on progress (simplistic logic)
            if (kr.progress === 100) kr.status = 'completed';
            else if (kr.progress < 25) kr.status = 'behind';
            else if (kr.progress < 75) kr.status = 'at_risk';
            else kr.status = 'on_track';

            totalProgress += kr.progress;
        });

        // Average progress could be used as an alignment heuristic
        this.alignmentScore = totalProgress / this.keyResults.length;
    }
    next();
});

const OKR = mongoose.model('OKR', okrSchema);
export default OKR;
