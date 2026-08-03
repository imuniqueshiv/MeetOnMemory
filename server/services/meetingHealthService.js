import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import MeetingFeedback from "../models/meetingFeedbackModel.js";
import MeetingHealth from "../models/meetingHealthModel.js";

export const calculateMeetingHealth = async (meetingId) => {
  try {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new Error("Meeting not found");
    }

    // 1. Agenda Coverage (0-100)
    let agendaCoverage = 100;
    if (meeting.agendaItems && meeting.agendaItems.length > 0) {
      const completedItems = meeting.agendaItems.filter(
        (item) => item.status === "completed",
      ).length;
      agendaCoverage = Math.round(
        (completedItems / meeting.agendaItems.length) * 100,
      );
    }

    // 2. Time Adherence (0-100)
    let timeAdherence = 100;
    if (meeting.duration && meeting.duration > 0) {
      // Calculate actual total duration based on agenda items if they have it, or estimate
      // If we don't have accurate actual duration, we can use a heuristic or 100
      let totalActualMs = 0;
      if (meeting.agendaItems && meeting.agendaItems.length > 0) {
        totalActualMs = meeting.agendaItems.reduce(
          (acc, item) => acc + (item.actualDuration || 0),
          0,
        );
      }

      const totalActualMinutes = totalActualMs / 60000;

      if (totalActualMinutes > 0) {
        const diffRatio =
          Math.abs(totalActualMinutes - meeting.duration) / meeting.duration;
        // Decrease by 1 for every 1% off, floor at 0
        timeAdherence = Math.max(0, Math.round(100 - diffRatio * 100));
      }
    }

    // 3. Action Item Clarity (0-100)
    let actionItemClarity = 100;
    const actionItems = await ActionItem.find({ sourceMeetingId: meetingId });
    if (actionItems.length > 0) {
      const clearItems = actionItems.filter(
        (item) => item.owner && item.owner !== "Unassigned" && item.dueDate,
      ).length;
      actionItemClarity = Math.round((clearItems / actionItems.length) * 100);
    }

    // 4. Sentiment (0-100)
    let sentiment = 100;
    const feedbacks = await MeetingFeedback.find({ meetingId });
    if (feedbacks.length > 0) {
      const avgRating =
        feedbacks.reduce((acc, fb) => acc + fb.overallRating, 0) /
        feedbacks.length;
      // Convert 1-5 scale to 0-100
      sentiment = Math.round(((avgRating - 1) / 4) * 100);
    } else {
      // Neutral if no feedback
      sentiment = 50;
    }

    // 5. Engagement (0-100)
    let engagement = 50;
    if (meeting.participants && meeting.participants.length > 0) {
      const participantCount = meeting.participants.length;

      // People who gave feedback or got action items assigned
      const engagedEmails = new Set();

      // action item owners
      actionItems.forEach((ai) => {
        if (ai.owner && ai.owner !== "Unassigned") {
          engagedEmails.add(ai.owner.toLowerCase());
        }
      });

      // feedbacks
      // We would ideally map feedback userId to participant emails, but since we don't have that mapping easily here,
      // we can just use the count as a heuristic
      const feedbackCount = feedbacks.length;

      // Rough heuristic for engagement:
      const uniqueActionItemOwners = engagedEmails.size;
      const totalEngaged = Math.min(
        uniqueActionItemOwners + feedbackCount,
        participantCount,
      );

      engagement = Math.round((totalEngaged / participantCount) * 100);

      // Give a boost if there is good interaction
      if (engagement < 50 && feedbacks.length > 0) {
        engagement = Math.min(100, engagement + 20);
      }
    }

    // Calculate Composite Score
    const compositeScore = Math.round(
      (agendaCoverage +
        timeAdherence +
        actionItemClarity +
        sentiment +
        engagement) /
        5,
    );

    // Generate Recommendations
    const recommendations = [];
    if (agendaCoverage < 50) {
      recommendations.push(
        "Consider reducing the number of agenda items or allocating more time per item.",
      );
    }
    if (timeAdherence < 70) {
      recommendations.push(
        "Try using a visible timer to keep the meeting on track.",
      );
    }
    if (actionItemClarity < 70) {
      recommendations.push(
        "Ensure all action items have a clear owner and due date before ending the meeting.",
      );
    }
    if (sentiment < 60) {
      recommendations.push(
        "Review meeting feedback to address participant concerns and improve satisfaction.",
      );
    }
    if (engagement < 50) {
      recommendations.push(
        "Encourage more participant interaction, perhaps by asking direct questions or assigning roles.",
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Great job! This meeting scored highly across all health metrics.",
      );
    }

    // Save or update
    const healthRecord = await MeetingHealth.findOneAndUpdate(
      { meetingId },
      {
        organization: meeting.organization,
        compositeScore,
        factors: {
          agendaCoverage,
          timeAdherence,
          engagement,
          actionItemClarity,
          sentiment,
        },
        recommendations,
      },
      { new: true, upsert: true },
    );

    return healthRecord;
  } catch (error) {
    console.error("Error calculating meeting health:", error);
    throw error;
  }
};
