import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Organization name is required"],
        unique: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user', // <-- FIX
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user' // <-- FIX
    }]
}, { timestamps: true });

const Organization = mongoose.model('Organization', organizationSchema);

export default Organization;