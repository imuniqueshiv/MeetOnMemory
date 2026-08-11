import AgendaSuggestion from "../models/agendaSuggestionModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import FollowUpThread from "../models/followUpThreadModel.js";
import Meeting from "../models/meetingModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";
import { generateAgendaSuggestions as generateAI } from "./GenerativeAIService.js";

export class AgendaSuggestionAuthorizationError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "AgendaSuggestionAuthorizationError";
    this.statusCode = statusCode;
  }
}

const requireAgendaPermission = (user, action) => {
  if (!user) {
    throw new AgendaSuggestionAuthorizationError(401, "Unauthorized");
  }

  if (!user.organization) {
    throw new AgendaSuggestionAuthorizationError(
      403,
      "Forbidden: Organization membership required",
    );
  }

  if (!user.role || !hasPermission(user.role, "meetings", action)) {
    throw new AgendaSuggestionAuthorizationError(
      403,
      `Forbidden: You don't have permission to ${action} meetings`,
    );
  }
};

/**
 * Agenda suggestions are scoped to a meeting and its organization.
 * Keep this check centralized so every endpoint follows the same order:
 * user -> organization membership -> meeting access -> RBAC permission.
 */
export const authorizeAgendaMeeting = async (
  user,
  meetingId,
  action = "view",
) => {
  requireAgendaPermission(user, action);

  if (!meetingId) {
    throw new AgendaSuggestionAuthorizationError(
      400,
      "meetingId is required",
    );
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) {
    throw new AgendaSuggestionAuthorizationError(404, "Meeting not found");
  }

  // Agenda suggestions must never cross organization boundaries. Do not rely
  // on a client-supplied organizationId to establish access.
  if (
    !meeting.organization ||
    meeting.organization.toString() !== user.organization.toString()
  ) {
    throw new AgendaSuggestionAuthorizationError(
      403,
      "Forbidden: You don't have access to this meeting",
    );
  }

  return meeting;
};

export const generateSuggestions = async (
  organizationId,
  meetingId,
  user,
) => {
  // Validate the authenticated user's organization and meeting before using
  // any organization-scoped data or calling the AI service.
  await authorizeAgendaMeeting(user, meetingId, "edit");

  if (
    !organizationId ||
    organizationId.toString() !== user.organization.toString()
  ) {
    throw new AgendaSuggestionAuthorizationError(
      403,
      "Forbidden: Organization does not match the authenticated user",
    );
  }

  // 1. Gather Context
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [openActionItems, deferredDecisions, openThreads, recentMeetings] =
    await Promise.all([
      ActionItem.find({
        organization: user.organization,
        status: { $in: ["pending", "in_progress"] },
        createdAt: { $gte: thirtyDaysAgo },
      })
        .select("text status createdAt")
        .limit(20)
        .lean(),

      Decision.find({
        organization: user.organization,
        status: "deferred",
        createdAt: { $gte: thirtyDaysAgo },
      })
        .select("text status createdAt")
        .limit(10)
        .lean(),

      FollowUpThread.find({
        organization: user.organization,
        status: "open",
        createdAt: { $gte: thirtyDaysAgo },
      })
        .select("topic status createdAt")
        .limit(10)
        .lean(),

      Meeting.find({
        organization: user.organization,
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
    organization: user.organization,
    suggestions,
  });

  await agendaSuggestion.save();

  return agendaSuggestion;
};

export const applyAcceptedSuggestions = async (agendaSuggestionId, user) => {
  if (!user) {
    throw new AgendaSuggestionAuthorizationError(401, "Unauthorized");
  }

  const agendaSuggestion = await AgendaSuggestion.findById(
    agendaSuggestionId,
  );
  if (!agendaSuggestion) {
    throw new AgendaSuggestionAuthorizationError(
      404,
      "Agenda suggestion not found",
    );
  }

  const meeting = await authorizeAgendaMeeting(
    user,
    agendaSuggestion.meeting,
    "edit",
  );

  if (
    !agendaSuggestion.organization ||
    agendaSuggestion.organization.toString() !== user.organization.toString()
  ) {
    throw new AgendaSuggestionAuthorizationError(
      403,
      "Forbidden: Agenda suggestion belongs to another organization",
    );
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
