import MeetingNudge from "../models/meetingNudgeModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import Activity from "../models/activityModel.js";
import { createNotification } from "./notificationService.js";

export const evaluateUpcomingMeetings = async (hoursFromNow = 24) => {
  const now = new Date();
  const future = new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000);

  // Find meetings happening in the next 24 hours that haven't happened yet
  const upcomingMeetings = await Meeting.find({
    date: { $gt: now, $lte: future },
    status: { $ne: "completed" },
    deletedAt: null,
  }).populate("participants.user");

  for (const meeting of upcomingMeetings) {
    if (meeting.nudgesEnabled === false) continue;
    for (const participant of meeting.participants) {
      if (participant.user) {
        await generateNudgesForParticipant(
          meeting,
          participant.user._id.toString(),
        );
      }
    }
  }
};

export const generateNudgesForParticipant = async (
  meeting,
  userId,
  forceNotify = false,
) => {
  // 1. Check for unresolved action items assigned to this user
  const unresolvedItems = await ActionItem.find({
    assignee: userId,
    status: { $in: ["open", "in-progress", "pending"] },
    organization: meeting.organization, // or related to same series
  });

  // 2. Check if user has viewed the meeting agenda/details
  const activity = await Activity.findOne({
    actor: userId,
    targetId: meeting._id,
    action: { $in: ["meeting.viewed", "agenda.viewed"] },
  });

  const hasViewedAgenda = !!activity;

  let score = 100;
  let unresolvedCount = unresolvedItems.length;

  if (unresolvedCount > 0) {
    score -= Math.min(50, unresolvedCount * 10);
  }
  if (!hasViewedAgenda) {
    score -= 20;
  }

  // Create or Update General Prep Nudge with Score
  await MeetingNudge.findOneAndUpdate(
    { meetingId: meeting._id, recipientId: userId, nudgeType: "GENERAL_PREP" },
    {
      organization: meeting.organization,
      context: { unresolvedCount, hasViewedAgenda, score },
      readinessScore: score,
    },
    { upsert: true, new: true },
  );

  if (unresolvedCount > 0) {
    const nudge = await MeetingNudge.findOneAndUpdate(
      {
        meetingId: meeting._id,
        recipientId: userId,
        nudgeType: "UNRESOLVED_ACTION_ITEMS",
      },
      {
        organization: meeting.organization,
        context: {
          count: unresolvedCount,
          itemIds: unresolvedItems.map((i) => i._id),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    if (
      forceNotify ||
      (nudge &&
        nudge.status === "PENDING" &&
        nudge.createdAt &&
        nudge.createdAt.getTime() > Date.now() - 60000)
    ) {
      // Newly created or manual test trigger
      createNotification({
        userId: userId,
        title: "Action Items Pending for Upcoming Meeting",
        message: `You have ${unresolvedCount} unresolved action items before ${meeting.title}.`,
        type: "NUDGE",
        organization: meeting.organization,
        link: `/meetings/${meeting._id}`,
      }).catch(console.error);
    }
  }

  if (!hasViewedAgenda) {
    const nudge = await MeetingNudge.findOneAndUpdate(
      {
        meetingId: meeting._id,
        recipientId: userId,
        nudgeType: "AGENDA_REVIEW",
      },
      {
        organization: meeting.organization,
        context: { message: "Review the agenda to prepare." },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    if (
      forceNotify ||
      (nudge &&
        nudge.status === "PENDING" &&
        nudge.createdAt &&
        nudge.createdAt.getTime() > Date.now() - 60000)
    ) {
      // Newly created or manual test trigger
      createNotification({
        userId: userId,
        title: "Agenda Review Reminder",
        message: `Please review the agenda for ${meeting.title}.`,
        type: "NUDGE",
        organization: meeting.organization,
        link: `/meetings/${meeting._id}`,
      }).catch(console.error);
    }
  }

  return {
    userId,
    score,
    unresolvedCount,
    hasViewedAgenda,
  };
};

export const getPersonalNudges = async (userId, organizationId) => {
  const query = { recipientId: userId, status: "PENDING" };
  if (organizationId) query.organization = organizationId;
  return MeetingNudge.find(query).populate("meetingId", "title date time");
};

export const updateNudgeStatus = async (nudgeId, status) => {
  return MeetingNudge.findByIdAndUpdate(nudgeId, { status }, { new: true });
};

export const getMeetingReadiness = async (meetingId) => {
  const nudges = await MeetingNudge.find({
    meetingId,
    nudgeType: "GENERAL_PREP",
  }).populate("recipientId", "name email");
  if (!nudges.length) return null;

  const totalScore = nudges.reduce(
    (sum, n) => sum + (n.readinessScore || 0),
    0,
  );
  const averageScore = Math.round(totalScore / nudges.length);

  return {
    averageScore,
    participants: nudges.map((n) => ({
      user: n.recipientId,
      score: n.readinessScore,
      context: n.context,
    })),
  };
};

/**
 * Preview nudges that will be generated for a meeting (Issue #2062)
 */
export const previewMeetingNudges = async (meetingId) => {
  const meeting =
    await Meeting.findById(meetingId).populate("participants.user");
  if (!meeting) {
    throw new Error("Meeting not found");
  }

  const previews = [];
  for (const participant of meeting.participants || []) {
    const user = participant.user || participant;
    const userId = user._id ? user._id.toString() : user.toString();
    if (!userId) continue;

    const unresolvedItems = await ActionItem.find({
      assignee: userId,
      status: { $in: ["open", "in-progress", "pending"] },
      organization: meeting.organization,
    });

    const activity = await Activity.findOne({
      actor: userId,
      targetId: meeting._id,
      action: { $in: ["meeting.viewed", "agenda.viewed"] },
    });

    const hasViewedAgenda = !!activity;
    const unresolvedCount = unresolvedItems.length;
    let score = 100;
    if (unresolvedCount > 0) score -= Math.min(50, unresolvedCount * 10);
    if (!hasViewedAgenda) score -= 20;

    const plannedNudges = [];
    plannedNudges.push({
      type: "GENERAL_PREP",
      title: "Preparation Readiness",
      score,
      summary: `Participant readiness score: ${score}%`,
    });

    if (unresolvedCount > 0) {
      plannedNudges.push({
        type: "UNRESOLVED_ACTION_ITEMS",
        title: "Action Items Pending",
        count: unresolvedCount,
        summary: `Has ${unresolvedCount} open action item(s) pending before meeting.`,
      });
    }

    if (!hasViewedAgenda) {
      plannedNudges.push({
        type: "AGENDA_REVIEW",
        title: "Agenda Not Viewed",
        summary: "Has not opened or reviewed meeting agenda yet.",
      });
    }

    previews.push({
      user: {
        _id: userId,
        name: user.name || "Participant",
        email: user.email || "",
      },
      readinessScore: score,
      unresolvedCount,
      hasViewedAgenda,
      plannedNudges,
    });
  }

  const totalScore = previews.reduce((sum, p) => sum + p.readinessScore, 0);
  const avgScore = previews.length
    ? Math.round(totalScore / previews.length)
    : 100;

  return {
    meetingId,
    meetingTitle: meeting.title,
    nudgesEnabled: meeting.nudgesEnabled ?? true,
    averageScore: avgScore,
    totalParticipants: previews.length,
    participants: previews,
  };
};

/**
 * Manually trigger nudge test dispatch for organizer (Issue #2062)
 */
export const triggerMeetingNudges = async (meetingId, _organizerUserId) => {
  const meeting =
    await Meeting.findById(meetingId).populate("participants.user");
  if (!meeting) {
    throw new Error("Meeting not found");
  }

  let triggeredCount = 0;
  for (const participant of meeting.participants || []) {
    const user = participant.user || participant;
    const userId = user._id ? user._id.toString() : user.toString();
    if (!userId) continue;

    await generateNudgesForParticipant(meeting, userId, true);
    triggeredCount++;
  }

  return {
    success: true,
    message: `Generated and dispatched nudges to ${triggeredCount} participants.`,
    triggeredCount,
  };
};
