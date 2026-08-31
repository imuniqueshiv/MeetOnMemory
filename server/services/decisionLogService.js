import DecisionLogEntry from "../models/decisionLogEntryModel.js";
import mongoose from "mongoose";

class DecisionLogService {
  async createEntry(data) {
    const entry = new DecisionLogEntry(data);
    await entry.save();
    return entry;
  }

  async getLogByOrg(organizationId, options = {}) {
    const {
      page = 1,
      limit = 20,
      outcome,
      sortBy = "createdAt",
      sortOrder = -1,
    } = options;
    const query = {
      organizationId: new mongoose.Types.ObjectId(organizationId),
    };

    if (outcome) {
      query.outcome = outcome;
    }

    const skip = (page - 1) * limit;

    const entries = await DecisionLogEntry.find(query)
      .populate("decisionId", "text owner status resolvedAt")
      .populate("meetingId", "title date")
      .populate("decidedBy", "name email")
      .populate("linkedActionItems", "text status dueDate")
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);

    const total = await DecisionLogEntry.countDocuments(query);

    return {
      entries,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateOutcome(entryId, outcome, impactAssessment) {
    const updateData = { outcome };
    if (impactAssessment !== undefined) {
      updateData.impactAssessment = impactAssessment;
    }

    const entry = await DecisionLogEntry.findByIdAndUpdate(
      entryId,
      { $set: updateData },
      { new: true },
    )
      .populate("decisionId")
      .populate("meetingId")
      .populate("decidedBy")
      .populate("linkedActionItems");

    if (!entry) {
      throw new Error("Decision Log Entry not found");
    }
    return entry;
  }

  async linkActionItems(entryId, actionItemIds) {
    const entry = await DecisionLogEntry.findByIdAndUpdate(
      entryId,
      {
        $addToSet: {
          linkedActionItems: {
            $each: actionItemIds.map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
      },
      { new: true },
    ).populate("linkedActionItems");

    if (!entry) {
      throw new Error("Decision Log Entry not found");
    }
    return entry;
  }

  async getDecisionTimeline(organizationId) {
    const timeline = await DecisionLogEntry.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            outcome: "$outcome",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    // Format for easier consumption by frontend
    const formattedTimeline = timeline.reduce((acc, curr) => {
      const monthYear = `${curr._id.year}-${curr._id.month.toString().padStart(2, "0")}`;
      if (!acc[monthYear]) {
        acc[monthYear] = { monthYear };
      }
      acc[monthYear][curr._id.outcome] = curr.count;
      return acc;
    }, {});

    return Object.values(formattedTimeline);
  }

  async getOverdueReviews(organizationId) {
    const today = new Date();
    const entries = await DecisionLogEntry.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      reviewDate: { $ne: null, $lt: today },
    })
      .populate("decisionId")
      .populate("meetingId")
      .populate("decidedBy")
      .sort({ reviewDate: 1 });

    return entries;
  }

  async editEntry(entryId, data) {
    const { text, outcome, reviewDate, tags, decidedBy, meetingId } = data;

    const entry = await DecisionLogEntry.findById(entryId);
    if (!entry) {
      throw new Error("Decision Log Entry not found");
    }

    if (outcome) entry.outcome = outcome;
    if (reviewDate !== undefined) entry.reviewDate = reviewDate;
    if (tags !== undefined) entry.tags = tags;
    if (decidedBy) entry.decidedBy = decidedBy;
    if (meetingId) entry.meetingId = meetingId;

    await entry.save();

    if (entry.decisionId) {
      const decisionUpdate = {};
      if (text) decisionUpdate.text = text;
      if (outcome) {
        if (outcome === "implemented") decisionUpdate.status = "resolved";
        else if (outcome === "superseded") decisionUpdate.status = "superseded";
        else if (outcome === "reversed") decisionUpdate.status = "failed";
        else if (outcome === "deferred") decisionUpdate.status = "in-progress";
        else decisionUpdate.status = "open";
      }
      if (Object.keys(decisionUpdate).length > 0) {
        const Decision = (await import("../models/decisionModel.js")).default;
        await Decision.findByIdAndUpdate(entry.decisionId, {
          $set: decisionUpdate,
        });
      }
    }

    return await DecisionLogEntry.findById(entryId)
      .populate("decisionId")
      .populate("meetingId")
      .populate("decidedBy")
      .populate("linkedActionItems");
  }

  async deleteEntry(entryId) {
    const entry = await DecisionLogEntry.findById(entryId);
    if (!entry) {
      throw new Error("Decision Log Entry not found");
    }

    if (entry.decisionId) {
      const Decision = (await import("../models/decisionModel.js")).default;
      await Decision.findByIdAndDelete(entry.decisionId);
    }

    await DecisionLogEntry.findByIdAndDelete(entryId);
    return true;
  }

  async exportLog(organizationId, format = "json") {
    const entries = await DecisionLogEntry.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
    })
      .populate("decisionId")
      .populate("meetingId")
      .populate("decidedBy");

    if (format === "csv") {
      const headers =
        "Decision ID,Title/Text,Outcome,Meeting,Decided By,Review Date,Tags\n";
      const rows = entries
        .map((e) => {
          const id = e._id ? e._id.toString() : "";
          const text = e.decisionId?.text
            ? e.decisionId.text.replace(/"/g, '""')
            : "";
          const outcome = e.outcome || "";
          const meeting = e.meetingId?.title
            ? e.meetingId.title.replace(/"/g, '""')
            : "";
          const decidedBy = e.decidedBy?.name
            ? e.decidedBy.name.replace(/"/g, '""')
            : "";
          const reviewDate = e.reviewDate
            ? new Date(e.reviewDate).toISOString()
            : "";
          const tags = (e.tags || []).join(";");
          return `"${id}","${text}","${outcome}","${meeting}","${decidedBy}","${reviewDate}","${tags}"`;
        })
        .join("\n");
      return headers + rows;
    }

    return entries;
  }
}

export default new DecisionLogService();
