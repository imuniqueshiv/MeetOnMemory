import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {type: String, required: true},
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    verifyOtp: {type: String, default: ""},
    verifyOtpExpireAt: {type: Number, default: 0},
    isAccountVerified: {type: Boolean, default: false},
    resetOtp: {type: String, default: ""},
    resetOtpExpireAt: {type: Number, default: 0},

    // --- NEW FIELDS ADDED ---
    role: {
        type: String,
        enum: ['admin', 'member'],
        default: null // Will be null until they complete onboarding
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization', // This will link to the new Organization model
        default: null
    },
    hasCompletedOnboarding: {
        type: Boolean,
        default: false // This flag is crucial
    }
}, { timestamps: true }); // Added timestamps to track user creation/updates

const userModel  = mongoose.models.user || mongoose.model('user', userSchema);

export default userModel;