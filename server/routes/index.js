import express from "express";
import authRoutes from "./authRoutes.js";
import organizationRoutes from "./organizationRoutes.js";
import membershipRoutes from "./membershipRoutes.js";
import membershipRequestRoutes from "./membershipRequestRoutes.js";
import invitationRoutes from "./invitationRoutes.js";
import meetingRoutes from "./meetingRoutes.js";
import searchRoutes from "./searchRoutes.js";
import aiRoutes from "./aiRoutes.js";
import policyRoutes from "./policyRoutes.js";
import analyticsRoutes from "./analyticsRoutes.js";
import actionItemAnalyticsRoutes from "./actionItemAnalyticsRoutes.js";
import standupRoutes from "./standupRoutes.js";
import geminiRoutes from "./geminiRoutes.js";
import notesRoutes from "./notes.routes.js";
import userRoutes from "./userRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import knowledgeRoutes from "./knowledgeRoutes.js";
import knowledgeGraphRoutes from "./knowledgeGraphRoutes.js";
import policyComplianceRoutes from "./policyComplianceRoutes.js";
import sessionRoutes from "./sessionRoutes.js";
import transcriptRoutes from "./transcriptRoutes.js";
import transcriptChapterRoutes from "./transcriptChapterRoutes.js";
import meetingAttendanceRoutes from "./meetingAttendanceRoutes.js";
import customFieldRoutes from "./customFieldRoutes.js";
import sharedLinkRoutes from "./sharedLinkRoutes.js";
import meetingTemplateRoutes from "./meetingTemplateRoutes.js";
import meetingNoteTemplateRoutes from "./meetingNoteTemplateRoutes.js";
import bookmarkRoutes from "./bookmarkRoutes.js";
import commentRoutes from "./commentRoutes.js";
import activityRoutes from "./activityRoutes.js";
import tagRoutes from "./tagRoutes.js";
import pollRoutes from "./pollRoutes.js";
import attachmentRoutes from "./attachmentRoutes.js";
import meetingSeriesRoutes from "./meetingSeriesRoutes.js";
import carryForwardRoutes from "./carryForwardRoutes.js";
import comparisonRoutes from "./comparisonRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import agendaTimerRoutes from "./agendaTimerRoutes.js";
import digestRoutes from "./digestRoutes.js";
import decisionGraphRoutes from "./decisionGraphRoutes.js";
import decisionLogRoutes from "./decisionLogRoutes.js";
import decisionImpactRoutes from "./decisionImpactRoutes.js";
import attendanceAnalyticsRoutes from "./attendanceAnalyticsRoutes.js";
import meetingFeedbackRoutes from "./meetingFeedbackRoutes.js";
import meetingCostRoutes from "./meetingCostRoutes.js";
import followUpThreadRoutes from "./followUpThreadRoutes.js";
import followUpRoutes from "./followUpRoutes.js";
import schedulerRoutes from "./scheduler.routes.js";
import recapScheduleRoutes from "./recapScheduleRoutes.js";
import meetingClipRoutes from "./meetingClipRoutes.js";
import speakerMappingRoutes from "./speakerMappingRoutes.js";
import noteVersionRoutes from "./noteVersionRoutes.js";
import reportRoutes from "./reportRoutes.js";
import agendaSuggestionRoutes from "./agendaSuggestionRoutes.js";
import translationRoutes from "./translationRoutes.js";
import personalNoteRoutes from "./personalNoteRoutes.js";
import templateLibraryRoutes from "./templateLibraryRoutes.js";
import transcriptAnnotationRoutes from "./transcriptAnnotationRoutes.js";
import glossaryRoutes from "./glossaryRoutes.js";
import aiSummaryTemplateRoutes from "./aiSummaryTemplateRoutes.js";
import topicRoutes from "./topicRoutes.js";
import topicIntelligenceRoutes from "./topicIntelligenceRoutes.js";
import automationRuleRoutes from "./automationRuleRoutes.js";
import meetingHealthRoutes from "./meetingHealthRoutes.js";
import workspaceRoutes from "./workspaceRoutes.js";
import recapRoutes from "./recapRoutes.js";
import focusTimeRoutes from "./focusTimeRoutes.js";
import recapStoryRoutes from "./recapStoryRoutes.js";
import meetingQualityRoutes from "./meetingQualityRoutes.js";
import effectivenessRoutes from "./effectivenessRoutes.js";
import exportRoutes from "./export.routes.js";
import keyMomentRoutes from "./keyMomentRoutes.js";
import meetingGoalRoutes from "./meetingGoalRoutes.js";
import meetingTimelineRoutes from "./meetingTimelineRoutes.js";
import highlightReelRoutes from "./highlightReelRoutes.js";
import actionItemDependencyRoutes from "./actionItemDependencyRoutes.js";
import bulkMeetingRoutes from "./bulkMeetingRoutes.js";
import parkingLotRoutes from "./parkingLotRoutes.js";
import sentimentTimelineRoutes from "./sentimentTimelineRoutes.js";
import meetingRsvpRoutes from "./meetingRsvpRoutes.js";
import favoriteRoutes from "./favoriteRoutes.js";
import testimonialRoutes, {
  adminTestimonialRouter,
} from "./testimonialRoutes.js";
import absenteeCatchUpRoutes from "./absenteeCatchUpRoutes.js";
import asyncMeetingRoutes from "./asyncMeetingRoutes.js";

import calendarRoutes from "./calendarRoutes.js";
import assistantRoutes from "./assistantRoutes.js";
import savedFilterRoutes from "./savedFilterRoutes.js";
import meetingChecklistRoutes from "./meetingChecklistRoutes.js";
import speakingTimeRoutes from "./speakingTimeRoutes.js";
import keywordAlertRoutes from "./keywordAlertRoutes.js";
import agendaVoteRoutes from "./agendaVoteRoutes.js";
import agendaBuilderRoutes from "./agendaBuilderRoutes.js";
import meetingDuplicateRoutes from "./meetingDuplicateRoutes.js";
import meetingDelegationRoutes from "./meetingDelegationRoutes.js";
import breakoutRoomRoutes from "./breakoutRoomRoutes.js";

import notionIntegrationRoutes from "./notionIntegrationRoutes.js";
import gamificationRoutes from "./gamificationRoutes.js";
import actionItemsRoutes from "./actionItems.routes.js";
import workloadRoutes from "./workloadRoutes.js";
import minutesApprovalRoutes from "./minutesApprovalRoutes.js";
import teamAvailabilityRoutes from "./teamAvailabilityRoutes.js";
import icebreakerRoutes from "./icebreakerRoutes.js";
import meetingQuizRoutes from "./meetingQuizRoutes.js";
import resourceBookingRoutes from "./resourceBookingRoutes.js";
import recordingSessionRoutes from "./recordingSessionRoutes.js";
import meetingPlaybookRoutes from "./meetingPlaybookRoutes.js";

const router = express.Router();

// ==========================================
// ALL PROTECTED ROUTES (CSRF Enforced globally in express.js)
// ==========================================
router.use("/api/auth", authRoutes);
router.use(["/api/organization", "/api/organizations"], organizationRoutes);
router.use(["/api/membership", "/api/memberships"], membershipRoutes);
router.use(
  ["/api/membership-request", "/api/membership-requests"],
  membershipRequestRoutes,
);
router.use(["/api/invitation", "/api/invitations"], invitationRoutes);
router.use("/api/meetings/timer", agendaTimerRoutes);
router.use("/api/meetings/:meetingId/checklist", meetingChecklistRoutes);
router.use("/api/meetings/:id/duplicates", meetingDuplicateRoutes);
router.use("/api/delegations", meetingDelegationRoutes);
router.use("/api/meetings/:meetingId/quiz", meetingQuizRoutes);
router.use("/api/playbooks", meetingPlaybookRoutes);
router.use("/api/meetings", meetingRoutes);
router.use("/api/meetings", meetingTimelineRoutes);
router.use("/api/meetings", highlightReelRoutes);
router.use("/api/bulk/meetings", bulkMeetingRoutes);
router.use("/api/meetings", agendaVoteRoutes);
router.use("/api/meetings", agendaBuilderRoutes);
router.use("/api/search", searchRoutes);
router.use("/api/ai", aiRoutes);
router.use("/api/policies", policyRoutes);
router.use("/api/analytics", analyticsRoutes);
router.use("/api/action-item-analytics", actionItemAnalyticsRoutes);
router.use("/api/standup", standupRoutes);
router.use("/api/gemini", geminiRoutes);
router.use("/api/notes", notesRoutes);
router.use("/api/favorites", favoriteRoutes);
router.use(["/api/user", "/api/users"], userRoutes);
router.use(["/api/notification", "/api/notifications"], notificationRoutes);
router.use("/api/knowledge", knowledgeRoutes);
router.use("/api/graph", knowledgeGraphRoutes);
router.use("/api/calendar", calendarRoutes);
router.use("/api/policy-compliance", policyComplianceRoutes);
router.use("/api/sessions", sessionRoutes);
router.use("/api/recording-sessions", recordingSessionRoutes);
router.use("/api/assistant", assistantRoutes);
router.use("/api/transcripts", transcriptRoutes);
router.use("/api/meetings/:meetingId/chapters", transcriptChapterRoutes);
router.use("/api/meetings/:meetingId/attendance", meetingAttendanceRoutes);
router.use("/api/shared-links", sharedLinkRoutes);
router.use("/api/templates", meetingTemplateRoutes);
router.use("/api/note-templates", meetingNoteTemplateRoutes);
router.use("/api/bookmarks", bookmarkRoutes);
router.use("/api/comments", commentRoutes);
router.use("/api/activities", activityRoutes);
router.use("/api/tags", tagRoutes);
router.use("/api/polls", pollRoutes);
router.use("/api/meetings/:meetingId/topics", topicRoutes);
router.use("/api/meetings/:meetingId/breakout-rooms", breakoutRoomRoutes);
router.use("/api/workload", workloadRoutes);
router.use("/api/meetings/:meetingId/attachments", attachmentRoutes);
router.use("/api/icebreakers", icebreakerRoutes);
router.use("/api/physical-resources", resourceBookingRoutes);
router.use("/api/meetings/:meetingId/minutes-approval", minutesApprovalRoutes);
router.use("/api/meeting-series", meetingSeriesRoutes);
router.use("/api/meeting-series", carryForwardRoutes);
router.use("/api", carryForwardRoutes);
router.use("/api/comparison", comparisonRoutes);
router.use("/api/dashboard", dashboardRoutes);
router.use("/api/digest-preferences", digestRoutes);
router.use("/api/decision-graph", decisionGraphRoutes);
router.use("/api/decision-log", decisionLogRoutes);
router.use("/api/decisions", decisionImpactRoutes);
router.use("/api/attendance-analytics", attendanceAnalyticsRoutes);
router.use("/api/feedback", meetingFeedbackRoutes);
router.use("/api/meeting-cost", meetingCostRoutes);
router.use("/api/follow-up-threads", followUpThreadRoutes);
router.use("/api/followup", followUpRoutes);
router.use("/api/scheduler", schedulerRoutes);
router.use("/api/recap-schedule", recapScheduleRoutes);
router.use("/api/clips", meetingClipRoutes);
router.use(
  ["/api/speaker-mapping", "/api/speaker-mappings"],
  speakerMappingRoutes,
);
router.use("/api/note-versions", noteVersionRoutes);
router.use("/api/reports", reportRoutes);
router.use("/api/agenda-suggestions", agendaSuggestionRoutes);
router.use(["/api/translation", "/api/translations"], translationRoutes);
router.use("/api/personal-notes", personalNoteRoutes);
router.use("/api/template-library", templateLibraryRoutes);
router.use("/api/transcript-annotations", transcriptAnnotationRoutes);
router.use("/api/glossary", glossaryRoutes);
router.use("/api/ai-summary-templates", aiSummaryTemplateRoutes);
router.use("/api/topics", topicRoutes);
router.use("/api/topic-intelligence", topicIntelligenceRoutes);
router.use("/api/automation-rules", automationRuleRoutes);
router.use("/api/meeting-health", meetingHealthRoutes);
router.use("/api/workspace", workspaceRoutes);
router.use("/api/recap", recapRoutes);
router.use("/api/focus-time", focusTimeRoutes);
router.use("/api/meetings", recapStoryRoutes);
router.use("/api/quality", meetingQualityRoutes);
router.use("/api/effectiveness", effectivenessRoutes);
router.use(["/api/export-templates", "/api/exports"], exportRoutes);
router.use("/api/saved-filters", savedFilterRoutes);
router.use("/api/key-moments", keyMomentRoutes);
router.use("/api/speaking-time", speakingTimeRoutes);
router.use("/api/meeting-goals", meetingGoalRoutes);
router.use("/api/action-item-dependencies", actionItemDependencyRoutes);
router.use("/api/parking-lot", parkingLotRoutes);
router.use("/api/sentiment-timeline", sentimentTimelineRoutes);
router.use("/api/rsvps", meetingRsvpRoutes);
router.use("/api/testimonials", testimonialRoutes);
router.use("/api/admin/testimonials", adminTestimonialRouter);
router.use("/api/absentee-catchup", absenteeCatchUpRoutes);
router.use("/api/async-meetings", asyncMeetingRoutes);
import debriefQARoutes from "./debriefQARoutes.js";
router.use("/api/debrief", debriefQARoutes);
import adminJobsRoutes from "./adminJobsRoutes.js";
router.use("/api/admin/jobs", adminJobsRoutes);
import adminReindexRoutes from "./adminReindexRoutes.js";
router.use("/api/admin/embeddings", adminReindexRoutes);
import adminImportanceRoutes from "./adminImportanceRoutes.js";
router.use("/api/admin/importance", adminImportanceRoutes);
import adminHealthRoutes from "./adminHealthRoutes.js";
router.use("/api/admin/health", adminHealthRoutes);
import adminRbacRoutes from "./adminRbacRoutes.js";
router.use("/api/admin/rbac", adminRbacRoutes);
import adminAiUsageRoutes from "./adminAiUsageRoutes.js";
router.use("/api/admin/ai-usage", adminAiUsageRoutes);
router.use("/api/alerts/keywords", keywordAlertRoutes);
import integrationMarketplaceRoutes from "./integrationMarketplaceRoutes.js";
router.use("/api/integrations", integrationMarketplaceRoutes);
router.use("/api/integrations/notion", notionIntegrationRoutes);
import githubIntegrationRoutes from "./githubIntegrationRoutes.js";
router.use("/api/github", githubIntegrationRoutes);

import { handleWebhook } from "../controllers/githubWebhookController.js";
router.post("/api/webhooks/github", handleWebhook);

import issueTrackerRoutes from "./issueTrackerRoutes.js";
import issueTrackerWebhookRoutes from "./issueTrackerWebhookRoutes.js";
router.use("/api/issue-tracker", issueTrackerRoutes);
router.use("/api/webhooks", issueTrackerWebhookRoutes);

router.use("/api/gamification", gamificationRoutes);
router.use("/api/action-items", actionItemsRoutes);

import preMeetingBriefingRoutes from "./preMeetingBriefingRoutes.js";
router.use("/api/briefings", preMeetingBriefingRoutes);

import escalationRoutes from "./escalationRoutes.js";
router.use("/api/escalations", escalationRoutes);
import participantEngagementRoutes from "./participantEngagementRoutes.js";
router.use("/api/engagement", participantEngagementRoutes);
import participantContributionRoutes from "./participantContributionRoutes.js";
router.use(
  "/api/meetings/:meetingId/contributions",
  participantContributionRoutes,
);
import meetingPatternRoutes from "./meetingPatternRoutes.js";
router.use("/api/patterns", meetingPatternRoutes);

import guestAccessRoutes from "./guestAccessRoutes.js";
router.use("/api", guestAccessRoutes);
router.use("/api/custom-fields", customFieldRoutes);

import meetingNudgeRoutes from "./meetingNudgeRoutes.js";
router.use("/api/nudges", meetingNudgeRoutes);

import dataRetentionRoutes from "./dataRetentionRoutes.js";
router.use("/api/data-retention", dataRetentionRoutes);
import weeklyInsightRoutes from "./weeklyInsightRoutes.js";
router.use("/api/weekly-insights", weeklyInsightRoutes);
import standupReportRoutes from "./standupReportRoutes.js";
router.use("/api/standups", standupReportRoutes);
import meetingRiskRoutes from "./meetingRiskRoutes.js";
router.use("/api/meeting-risks", meetingRiskRoutes);

import actionItemSlaRoutes from "./actionItemSlaRoutes.js";
router.use("/api/action-item-sla", actionItemSlaRoutes);

router.use("/api/team-availability", teamAvailabilityRoutes);
import actionItemTemplateRoutes from "./actionItemTemplateRoutes.js";
router.use("/api/action-item-templates", actionItemTemplateRoutes);

import observerRoutes from "./observerRoutes.js";
router.use("/api/observers", observerRoutes);

import skillEndorsementRoutes from "./skillEndorsementRoutes.js";
router.use("/api/skill-endorsements", skillEndorsementRoutes);

import semanticKnowledgeGraphRoutes from "./semanticKnowledgeGraphRoutes.js";
router.use("/api/semantic-graph", semanticKnowledgeGraphRoutes);
import calendarConflictRoutes from "./calendarConflictRoutes.js";
router.use("/api/calendar-sync", calendarConflictRoutes);
import complianceRoutes from "./complianceRoutes.js";
router.use("/api/compliance", complianceRoutes);
import actionItemGraphRoutes from "./actionItemGraphRoutes.js";
router.use("/api/action-item-graph", actionItemGraphRoutes);

import recurringActionItemRoutes from "./recurringActionItemRoutes.js";
router.use("/api/recurring-action-items", recurringActionItemRoutes);

import apiKeyRoutes from "./apiKeyRoutes.js";
router.use("/api/api-keys", apiKeyRoutes);

import meetingRetrospectiveRoutes from "./meetingRetrospectiveRoutes.js";
router.use("/api/meeting-retrospectives", meetingRetrospectiveRoutes);

import meetingQuestionRoutes from "./meetingQuestionRoutes.js";
router.use("/api", meetingQuestionRoutes);

export default router;
