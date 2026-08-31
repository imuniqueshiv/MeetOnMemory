import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: "" },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, trim: true, default: "Uncategorized" },
    date: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { _id: true },
);

const meetingBudgetSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    totalBudget: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    expenses: { type: [expenseSchema], default: [] },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

meetingBudgetSchema.index({ organization: 1, createdAt: -1 });

const MeetingBudget =
  mongoose.models.MeetingBudget ||
  mongoose.model("MeetingBudget", meetingBudgetSchema);

export default MeetingBudget;
