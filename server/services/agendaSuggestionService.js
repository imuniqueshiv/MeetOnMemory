import AgendaSuggestion from "../models/agendaSuggestionModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import FollowUpThread from "../models/followUpThreadModel.js";
import Meeting from "../models/meetingModel.js";
import { generateAgendaSuggestions as generateAI } from "./GenerativeAIService.js";

export const generateSuggestions = async (organizationId, meetingId) => {
  // 1. Gather Context
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [openActionItems, deferredDecisions, openThreads, recentMeetings] =
    await Promise.all([
      ActionItem.find({
        organization: organizationId,
        status: { $in: ["pending", "in_progress"] },
        createdAt: { $gte: thirtyDaysAgo },
      })
        .select("text status createdAt")
        .limit(20)
        .lean(),

      Decision.find({
        organization: organizationId,
        status: "deferred",
        createdAt: { $gte: thirtyDaysAgo },
      })
        .select("text status createdAt")
        .limit(10)
        .lean(),

      FollowUpThread.find({
        organization: organizationId,
        status: "open",
        createdAt: { $gte: thirtyDaysAgo },
      })
        .select("topic status createdAt")
        .limit(10)
        .lean(),

      Meeting.find({
        organization: organizationId,
        status: "completed",
        createdAt: { $gte: thirtyDaysAgo },
      })
        .select("title summary agendaItems")
        .limit(5)
        .lean(),
    ]);

  const contextData = {
    openActionItems,
    deferredDecisions,
    openThreads,
    recentMeetings,
  };

  // 2. Call Generative AI
  const aiSuggestions = await generateAI(contextData);

  // 3. Map to Suggestion Item Schema format
  const suggestions = aiSuggestions.map((s) => ({
    text: s.text,
    description: s.description,
    estimatedDuration: s.estimatedDuration,
    source: {
      type: s.sourceType,
      referenceId: s.sourceId || null,
      title: s.sourceTitle || "AI Suggestion",
    },
    status: "pending",
    acceptedText: "",
  }));

  // 4. Save to DB
  const agendaSuggestion = new AgendaSuggestion({
    meeting: meetingId,
    organization: organizationId,
    suggestions,
  });

  await agendaSuggestion.save();

  return agendaSuggestion;
};

export const applyAcceptedSuggestions = async (agendaSuggestionId) => {
  const agendaSuggestion = await AgendaSuggestion.findById(agendaSuggestionId);
  if (!agendaSuggestion) {
    throw new Error("Agenda suggestion not found");
  }

  const meeting = await Meeting.findById(agendaSuggestion.meeting);
  if (!meeting) {
    throw new Error("Meeting not found");
  }

  const itemsToApply = agendaSuggestion.suggestions.filter(
    (s) => s.status === "accepted" || s.status === "edited",
  );

  const newAgendaItems = itemsToApply.map((s) => ({
    text: s.status === "edited" ? s.acceptedText : s.text,
    description: s.description,
    duration: s.estimatedDuration,
    status: "pending",
  }));

  meeting.agendaItems.push(...newAgendaItems);
  await meeting.save();

  agendaSuggestion.appliedAt = new Date();
  await agendaSuggestion.save();

  return meeting;
};
