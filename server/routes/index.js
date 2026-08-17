import express from 'express'
import authRoutes from './authRoutes.js'
import organizationRoutes from './organizationRoutes.js'
import membershipRoutes from './membershipRoutes.js'
import membershipRequestRoutes from './membershipRequestRoutes.js'
import invitationRoutes from './invitationRoutes.js'
import meetingRoutes from './meetingRoutes.js'
import searchRoutes from './searchRoutes.js'
import aiRoutes from './aiRoutes.js'
import policyRoutes from './policyRoutes.js'
import analyticsRoutes from './analyticsRoutes.js'
import geminiRoutes from './geminiRoutes.js'
import notesRoutes from './notes.routes.js'
import userRoutes from './userRoutes.js'
import notificationRoutes from './notificationRoutes.js'
import knowledgeRoutes from './knowledgeRoutes.js'
import knowledgeGraphRoutes from './knowledgeGraphRoutes.js'
import policyComplianceRoutes from './policyComplianceRoutes.js'
import sessionRoutes from './sessionRoutes.js'
import transcriptRoutes from './transcriptRoutes.js'
import sharedLinkRoutes from './sharedLinkRoutes.js'
import meetingTemplateRoutes from './meetingTemplateRoutes.js'
import bookmarkRoutes from './bookmarkRoutes.js'
import commentRoutes from './commentRoutes.js'
import activityRoutes from './activityRoutes.js'
import tagRoutes from './tagRoutes.js'
import pollRoutes from './pollRoutes.js'
import attachmentRoutes from './attachmentRoutes.js'
import meetingSeriesRoutes from './meetingSeriesRoutes.js'
import carryForwardRoutes from './carryForwardRoutes.js'
import comparisonRoutes from './comparisonRoutes.js'
import dashboardRoutes from './dashboardRoutes.js'
import agendaTimerRoutes from './agendaTimerRoutes.js'
import digestRoutes from './digestRoutes.js'
import decisionGraphRoutes from './decisionGraphRoutes.js'
import attendanceAnalyticsRoutes from './attendanceAnalyticsRoutes.js'
import meetingFeedbackRoutes from './meetingFeedbackRoutes.js'
import meetingCostRoutes from './meetingCostRoutes.js'
import followUpThreadRoutes from './followUpThreadRoutes.js'
import followUpRoutes from './followUpRoutes.js'
import schedulerRoutes from './scheduler.routes.js'
import recapScheduleRoutes from './recapScheduleRoutes.js'
import meetingClipRoutes from './meetingClipRoutes.js'
import speakerMappingRoutes from './speakerMappingRoutes.js'
import noteVersionRoutes from './noteVersionRoutes.js'
import reportRoutes from './reportRoutes.js'
import agendaSuggestionRoutes from './agendaSuggestionRoutes.js'
import translationRoutes from './translationRoutes.js'
import personalNoteRoutes from './personalNoteRoutes.js'
import templateLibraryRoutes from './templateLibraryRoutes.js'
import transcriptAnnotationRoutes from './transcriptAnnotationRoutes.js'
import glossaryRoutes from './glossaryRoutes.js'
import aiSummaryTemplateRoutes from './aiSummaryTemplateRoutes.js'
import topicRoutes from './topicRoutes.js'
import automationRuleRoutes from './automationRuleRoutes.js'
import meetingHealthRoutes from './meetingHealthRoutes.js'
import workspaceRoutes from './workspaceRoutes.js'
import recapRoutes from './recapRoutes.js'
import recapStoryRoutes from './recapStoryRoutes.js'
import meetingQualityRoutes from './meetingQualityRoutes.js'
import exportRoutes from './export.routes.js'
import keyMomentRoutes from './keyMomentRoutes.js'
import meetingGoalRoutes from './meetingGoalRoutes.js'
import meetingTimelineRoutes from './meetingTimelineRoutes.js'
import actionItemDependencyRoutes from './actionItemDependencyRoutes.js'
import bulkMeetingRoutes from './bulkMeetingRoutes.js'
import parkingLotRoutes from './parkingLotRoutes.js'
import sentimentTimelineRoutes from './sentimentTimelineRoutes.js'
import meetingRsvpRoutes from './meetingRsvpRoutes.js'
import favoriteRoutes from './favoriteRoutes.js'
import testimonialRoutes, { adminTestimonialRouter } from './testimonialRoutes.js'

import calendarRoutes from './calendarRoutes.js'
import assistantRoutes from './assistantRoutes.js'
import savedFilterRoutes from './savedFilterRoutes.js'
import meetingChecklistRoutes from './meetingChecklistRoutes.js'
import speakingTimeRoutes from './speakingTimeRoutes.js'
import keywordAlertRoutes from './keywordAlertRoutes.js'
import agendaVoteRoutes from './agendaVoteRoutes.js'
import meetingDuplicateRoutes from './meetingDuplicateRoutes.js'

import notionIntegrationRoutes from './notionIntegrationRoutes.js'
import gamificationRoutes from './gamificationRoutes.js'

const router = express.Router()

// ==========================================
// ALL PROTECTED ROUTES (CSRF Enforced globally in express.js)
// ==========================================
router.use('/api/auth', authRoutes)
router.use(['/api/organization', '/api/organizations'], organizationRoutes)
router.use(['/api/membership', '/api/memberships'], membershipRoutes)
router.use(['/api/membership-request', '/api/membership-requests'], membershipRequestRoutes)
router.use(['/api/invitation', '/api/invitations'], invitationRoutes)
router.use('/api/meetings/timer', agendaTimerRoutes)
router.use('/api/meetings/:meetingId/checklist', meetingChecklistRoutes)
router.use('/api/meetings/:id/duplicates', meetingDuplicateRoutes)
router.use('/api/meetings', meetingRoutes)
router.use('/api/meetings', meetingTimelineRoutes)
router.use('/api/bulk/meetings', bulkMeetingRoutes)
router.use('/api/meetings', agendaVoteRoutes)
router.use('/api/search', searchRoutes)
router.use('/api/ai', aiRoutes)
router.use('/api/policies', policyRoutes)
router.use('/api/analytics', analyticsRoutes)
router.use('/api/gemini', geminiRoutes)
router.use('/api/notes', notesRoutes)
router.use('/api/favorites', favoriteRoutes)
router.use(['/api/user', '/api/users'], userRoutes)
router.use(['/api/notification', '/api/notifications'], notificationRoutes)
router.use('/api/knowledge', knowledgeRoutes)
// The Knowledge Graph page (client/src/pages/KnowledgeGraph.jsx) and the
// controller's own JSDoc both address this router as /api/graph. It had no
// registration at all until Issue #1560, so every one of its endpoints 404'd.
router.use('/api/graph', knowledgeGraphRoutes)
router.use('/api/calendar', calendarRoutes)
// client/src/services/policyComplianceApi.js and every @route line in
// policyComplianceController.js address this router as /api/policy-compliance.
// It was mounted at /api/compliance, which nothing calls, so the whole
// compliance dashboard 404'd (Issue #1562).
router.use('/api/policy-compliance', policyComplianceRoutes)
router.use('/api/sessions', sessionRoutes)
router.use('/api/assistant', assistantRoutes)
router.use('/api/transcripts', transcriptRoutes)
router.use('/api/shared-links', sharedLinkRoutes)
router.use('/api/templates', meetingTemplateRoutes)
router.use('/api/bookmarks', bookmarkRoutes)
router.use('/api/comments', commentRoutes)
router.use('/api/activities', activityRoutes)
router.use('/api/tags', tagRoutes)
router.use('/api/polls', pollRoutes)
router.use('/api/meetings/:meetingId/attachments', attachmentRoutes)
router.use('/api/meeting-series', meetingSeriesRoutes)
router.use('/api/meeting-series', carryForwardRoutes)
router.use('/api/comparison', comparisonRoutes)
router.use('/api/dashboard', dashboardRoutes)
router.use('/api/digest-preferences', digestRoutes)
router.use('/api/decision-graph', decisionGraphRoutes)
router.use('/api/attendance-analytics', attendanceAnalyticsRoutes)
router.use('/api/feedback', meetingFeedbackRoutes)
router.use('/api/meeting-cost', meetingCostRoutes)
router.use('/api/follow-up-threads', followUpThreadRoutes)
// Follow-Up Workflow REST API (tasks/reminders/analytics) — Issue #1529.
// Distinct from /api/follow-up-threads (discussion threads). Frontend uses /api/followup/*.
router.use('/api/followup', followUpRoutes)
// Smart Scheduler — propose / retrieve / confirm (Issue #1530)
router.use('/api/scheduler', schedulerRoutes)
// Recap schedule + delivery history (GET /history/deliveries) — Issue #1401
router.use('/api/recap-schedule', recapScheduleRoutes)
router.use('/api/clips', meetingClipRoutes)
router.use('/api/speaker-mappings', speakerMappingRoutes)
router.use('/api/note-versions', noteVersionRoutes)
router.use('/api/reports', reportRoutes)
router.use('/api/agenda-suggestions', agendaSuggestionRoutes)
// Both spellings are in live use by the client and neither can be dropped
// without breaking a page: services/translationApi.js calls /api/translations,
// while MultiLanguageTranscript.jsx and LanguagePreferences.jsx call
// /api/translation, which was never mounted (Issue #1563). Aliased in the same
// style as /api/organization and /api/user above.
router.use(['/api/translation', '/api/translations'], translationRoutes)
router.use('/api/personal-notes', personalNoteRoutes)
router.use('/api/template-library', templateLibraryRoutes)
router.use('/api/transcript-annotations', transcriptAnnotationRoutes)
router.use('/api/glossary', glossaryRoutes)
router.use('/api/ai-summary-templates', aiSummaryTemplateRoutes)
router.use('/api/topics', topicRoutes)
router.use('/api/automation-rules', automationRuleRoutes)
router.use('/api/meeting-health', meetingHealthRoutes)
router.use('/api/workspace', workspaceRoutes)
router.use('/api/recap', recapRoutes)
router.use('/api/meetings', recapStoryRoutes)
// /api/quality is the prefix MeetingQuality.jsx calls and the prefix every
// @route line in meetingQualityController.js documents. The router was mounted
// at /api/meeting-quality, which nothing referenced, so the page 404'd on every
// request (Issue #1561).
router.use('/api/quality', meetingQualityRoutes)
router.use(['/api/export-templates', '/api/exports'], exportRoutes)
router.use('/api/saved-filters', savedFilterRoutes)
router.use('/api/key-moments', keyMomentRoutes)
router.use('/api/speaking-time', speakingTimeRoutes)
router.use('/api/meeting-goals', meetingGoalRoutes)
router.use('/api/action-item-dependencies', actionItemDependencyRoutes)
router.use('/api/parking-lot', parkingLotRoutes)
router.use('/api/sentiment-timeline', sentimentTimelineRoutes)
router.use('/api/rsvps', meetingRsvpRoutes)
router.use('/api/testimonials', testimonialRoutes)
router.use('/api/admin/testimonials', adminTestimonialRouter)
router.use('/api/alerts/keywords', keywordAlertRoutes)
router.use('/api/integrations/notion', notionIntegrationRoutes)

import githubIntegrationRoutes from './githubIntegrationRoutes.js'
router.use('/api/github', githubIntegrationRoutes)

import { handleWebhook } from '../controllers/githubWebhookController.js'
router.post('/api/webhooks/github', handleWebhook)

import issueTrackerRoutes from './issueTrackerRoutes.js'
import issueTrackerWebhookRoutes from './issueTrackerWebhookRoutes.js'
router.use('/api/issue-tracker', issueTrackerRoutes)
router.use('/api/webhooks', issueTrackerWebhookRoutes)

router.use('/api/gamification', gamificationRoutes)

import preMeetingBriefingRoutes from './preMeetingBriefingRoutes.js'
router.use('/api/briefings', preMeetingBriefingRoutes)

export default router
