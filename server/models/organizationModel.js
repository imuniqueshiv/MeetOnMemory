// server/models/organizationModel.js
import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      unique: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user", // reference to user model
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user", // reference to user model
      },
    ],
  },
  { timestamps: true }
);

const Organization = mongoose.models.Organization || mongoose.model("Organization", organizationSchema);

export default Organization;
