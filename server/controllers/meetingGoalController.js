import { z } from "zod";
import MeetingGoal from "../models/meetingGoalModel.js";
import Meeting from "../models/meetingModel.js";
import mongoose from "mongoose";
import { computeGoalRollup } from "../utils/goalRollup.js";

const setGoalsSchema = z.object({
  goals: z
    .array(
      z.object({
        text: z.string().min(1, "Goal text is required").max(200),
        description: z.string().max(1000).optional(),
      }),
    )
    .max(5, "Maximum 5 goals allowed"),
});

const updateGoalStatusSchema = z.object({
  status: z.enum(["pending", "achieved", "partially_achieved", "not_achieved"]),
  outcomeNote: z.string().max(2000).optional(),
});

export const setGoals = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { goals } = setGoalsSchema.parse(req.body);
    const userId = req.user._id;
    const userOrg = req.user.organization || req.user.activeOrganization;

    if (!userOrg) {
      return res
        .status(403)
        .json({ success: false, message: "Organization required" });
    }

    // Verify meeting exists and belongs to the user's organization
    const meeting = await Meeting.findOne({
      _id: meetingId,
      organization: userOrg,
      deletedAt: null,
    });

    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    // Only owner/creator can set goals (assuming uploadedBy is the owner)
    if (meeting.uploadedBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the meeting owner can set goals",
      });
    }

    let meetingGoal = await MeetingGoal.findOne({
      meetingId,
      organization: userOrg,
    });

    if (meetingGoal) {
      meetingGoal.goals = goals.map((g) => ({ ...g, status: "pending" }));
      meetingGoal.organization = meeting.organization; // Force context from the authorized meeting
      await meetingGoal.save();
    } else {
      meetingGoal = await MeetingGoal.create({
        meetingId,
        organization: meeting.organization, // Derived from authorized meeting context
        createdBy: userId,
        goals: goals.map((g) => ({ ...g, status: "pending" })),
      });
    }

    return res.status(200).json({ success: true, meetingGoal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }
    next(error);
  }
};

export const getGoals = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userOrg = req.user.organization || req.user.activeOrganization;

    if (!userOrg) {
      return res
        .status(403)
        .json({ success: false, message: "Organization required" });
    }

    // Ensure the meeting itself belongs to the authorized organization (multi-tenant boundary)
    const meeting = await Meeting.findOne({
      _id: meetingId,
      organization: userOrg,
      deletedAt: null,
    });

    if (!meeting) {
      return res.status(403).json({
        success: false,
        message: "Access denied: different organization or meeting not found",
      });
    }

    const meetingGoal = await MeetingGoal.findOne({
      meetingId,
      organization: userOrg,
    });

    if (!meetingGoal) {
      return res.status(200).json({ success: true, meetingGoal: null });
    }

    return res.status(200).json({ success: true, meetingGoal });
  } catch (error) {
    next(error);
  }
};

/**
 * Aggregate goal outcomes across every occurrence of a meeting's series.
 * If the meeting is not part of a series, the rollup covers just that meeting.
 * @route GET /api/meeting-goals/meeting/:meetingId/series-rollup
 */
export const getSeriesGoalRollup = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userOrg = req.user.organization || req.user.activeOrganization;

    if (!userOrg) {
      return res
        .status(403)
        .json({ success: false, message: "Organization required" });
    }

    const meeting = await Meeting.findOne({
      _id: meetingId,
      organization: userOrg,
      deletedAt: null,
    });

    if (!meeting) {
      return res.status(403).json({
        success: false,
        message: "Access denied: different organization or meeting not found",
      });
    }

    // Every meeting in the same series (org-scoped); or just this one if it's standalone.
    const seriesFilter = meeting.series
      ? { series: meeting.series, organization: userOrg, deletedAt: null }
      : { _id: meeting._id, organization: userOrg, deletedAt: null };
    const meetings = await Meeting.find(seriesFilter).select(
      "_id seriesOccurrence title",
    );

    const meetingIds = meetings.map((m) => m._id);
    const goalDocs = await MeetingGoal.find({
      meetingId: { $in: meetingIds },
      organization: userOrg,
    });
    const goalsByMeeting = new Map(
      goalDocs.map((doc) => [doc.meetingId.toString(), doc.goals]),
    );

    const entries = meetings.map((m) => ({
      meetingId: m._id,
      seriesOccurrence:
        typeof m.seriesOccurrence === "number" ? m.seriesOccurrence : null,
      goals: goalsByMeeting.get(m._id.toString()) || [],
    }));

    const rollup = computeGoalRollup(entries);

    return res.status(200).json({
      success: true,
      seriesId: meeting.series || null,
      meetingCount: meetings.length,
      rollup,
    });
  } catch (error) {
    next(error);
  }
};

export const updateGoalStatus = async (req, res, next) => {
  try {
    const { meetingId, goalId } = req.params;
    const { status, outcomeNote } = updateGoalStatusSchema.parse(req.body);
    const userId = req.user._id;
    const userOrg = req.user.organization || req.user.activeOrganization;

    if (!userOrg) {
      return res
        .status(403)
        .json({ success: false, message: "Organization required" });
    }

    const meeting = await Meeting.findOne({
      _id: meetingId,
      organization: userOrg,
      deletedAt: null,
    });

    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    // Prevent updating goals before the meeting date
    if (new Date() < new Date(meeting.date)) {
      return res.status(400).json({
        success: false,
        message: "Cannot update goal status before the meeting occurs",
      });
    }

    const meetingGoal = await MeetingGoal.findOne({
      meetingId,
      organization: userOrg,
    });
    if (!meetingGoal) {
      return res
        .status(404)
        .json({ success: false, message: "Goals not found for this meeting" });
    }

    const goal = meetingGoal.goals.id(goalId);
    if (!goal) {
      return res
        .status(404)
        .json({ success: false, message: "Goal not found" });
    }

    goal.status = status;
    if (outcomeNote !== undefined) {
      goal.outcomeNote = outcomeNote;
    }
    goal.resolvedBy = userId;
    goal.resolvedAt = new Date();

    await meetingGoal.save();

    return res.status(200).json({ success: true, meetingGoal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }
    next(error);
  }
};

export const getOrgGoalStats = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const userOrg = req.user.organization || req.user.activeOrganization;

    // Check if user is part of the org
    if (!userOrg || userOrg.toString() !== orgId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized for this organization",
      });
    }

    const pipeline = [
      {
        $match: {
          organization: new mongoose.Types.ObjectId(userOrg),
        },
      },
      { $unwind: "$goals" },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalGoals: { $sum: 1 },
          achievedGoals: {
            $sum: {
              $cond: [{ $eq: ["$goals.status", "achieved"] }, 1, 0],
            },
          },
          partiallyAchievedGoals: {
            $sum: {
              $cond: [{ $eq: ["$goals.status", "partially_achieved"] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          totalGoals: 1,
          achievedGoals: 1,
          partiallyAchievedGoals: 1,
          achievementRate: {
            $multiply: [
              {
                $divide: [
                  {
                    $add: [
                      "$achievedGoals",
                      { $multiply: ["$partiallyAchievedGoals", 0.5] },
                    ],
                  },
                  "$totalGoals",
                ],
              },
              100,
            ],
          },
        },
      },
      { $sort: { year: 1, month: 1 } },
    ];

    const stats = await MeetingGoal.aggregate(pipeline);

    // Format the month for the frontend (e.g., "Jan 2023")
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const formattedStats = stats.map((stat) => ({
      ...stat,
      monthName: `${monthNames[stat.month - 1]} ${stat.year}`,
    }));

    return res.status(200).json({ success: true, stats: formattedStats });
  } catch (error) {
    next(error);
  }
};
