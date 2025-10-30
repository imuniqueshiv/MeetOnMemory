import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user', // <-- FIX
        required: true
    },
    title: {
        type: String,
        required: [true, "Meeting title is required"],
    },
    date: {
        type: Date,
        required: [true, "Meeting date is required"],
    },
    status: {
        type: String,
        enum: ['Upcoming', 'Completed', 'Processing'],
        default: 'Upcoming'
    },
    transcript: {
        type: String,
        default: ''
    },
    summary: {
        type: String,
        default: ''
    },
    actionItems: {
        type: [String],
        default: []
    },
    audioFileUrl: {
        type: String,
        default: ''
    }
}, { timestamps: true });

const Meeting = mongoose.model('Meeting', meetingSchema);

export default Meeting;