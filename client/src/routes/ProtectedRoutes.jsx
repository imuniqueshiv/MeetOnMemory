import React, { lazy } from "react";
import { Route } from "react-router-dom";

import ProtectedRoute from "../components/ProtectedRoute.jsx";
import RouteErrorBoundary from "../components/RouteErrorBoundary.jsx";
import AccessDenied from "../pages/AccessDenied.jsx";

const MeetingListPage = lazy(() => import("../pages/MeetingListPage.jsx"));
const OrganizationHub = lazy(() => import("../pages/OrganizationHub.jsx"));
const JoinOrganizationPage = lazy(
  () => import("../pages/JoinOrganizationPage.jsx"),
);
const CreateOrganizationPage = lazy(
  () => import("../pages/CreateOrganizationPage.jsx"),
);
const BrowseOrganizations = lazy(
  () => import("../pages/BrowseOrganizations/BrowseOrganizations.jsx"),
);
const OrganizationSettings = lazy(
  () => import("../pages/OrganizationSettings.jsx"),
);
const Dashboard = lazy(() => import("../pages/Dashboard.jsx"));
const CompareMeetings = lazy(() => import("../pages/MeetingComparison.jsx"));
const CreateMeeting = lazy(() => import("../pages/CreateMeeting.jsx"));
const MeetingTemplates = lazy(() => import("../pages/MeetingTemplates.jsx"));
const TemplateLibrary = lazy(() => import("../pages/TemplateLibrary.jsx"));
const UploadMeeting = lazy(() => import("../pages/UploadMeeting.jsx"));
const Policies = lazy(() => import("../pages/Policies.jsx"));
const AiSummaryTemplates = lazy(
  () => import("../pages/AiSummaryTemplates.jsx"),
);
const Summaries = lazy(() => import("../pages/Summaries.jsx"));
const Reports = lazy(() => import("../pages/Reports.jsx"));
const WeeklyInsights = lazy(() => import("../pages/WeeklyInsights.jsx"));
const ReportBuilder = lazy(() => import("../pages/ReportBuilder.jsx"));
const AiSearch = lazy(() => import("../pages/AiSearch.jsx"));
const AiAssistant = lazy(() => import("../pages/AiAssistant.jsx"));
const MeetingDetails = lazy(() => import("../pages/MeetingDetails.jsx"));
const MeetingBriefing = lazy(() => import("../pages/MeetingBriefing.jsx"));
const MeetingQuality = lazy(() => import("../pages/MeetingQuality.jsx"));
const MeetingEffectiveness = lazy(
  () => import("../pages/MeetingEffectiveness.jsx"),
);
const MeetingRecycleBin = lazy(() => import("../pages/MeetingRecycleBin.jsx"));
const MeetingRoom = lazy(() => import("../pages/MeetingRoom.jsx"));
const TranscriptViewer = lazy(() => import("../pages/TranscriptViewer.jsx"));
const TeamMembers = lazy(() => import("../pages/TeamMembers.jsx"));
const Profile = lazy(() => import("../pages/Profile.jsx"));
const Calendar = lazy(() => import("../pages/Calendar.jsx"));
const Notifications = lazy(() => import("../pages/Notifications.jsx"));
const Tasks = lazy(() => import("../pages/Tasks.jsx"));
const KnowledgeTimeline = lazy(() => import("../pages/KnowledgeTimeline.jsx"));
const MemoryConsolidation = lazy(
  () => import("../pages/MemoryConsolidation.jsx"),
);
const MemoryLifecycle = lazy(() => import("../pages/MemoryLifecycle.jsx"));
const EnterpriseMemoryTelemetry = lazy(
  () => import("../pages/EnterpriseMemoryTelemetry.jsx"),
);
const KnowledgeArchive = lazy(() => import("../pages/KnowledgeArchive.jsx"));
const GraphSnapshots = lazy(() => import("../pages/GraphSnapshots.jsx"));
const KnowledgeGraph = lazy(() => import("../pages/KnowledgeGraph.jsx"));
const DecisionGraph = lazy(() => import("../pages/DecisionGraph.jsx"));
const DecisionDependencyMatrix = lazy(
  () => import("../pages/DecisionDependencyMatrix.jsx"),
);
const DecisionLog = lazy(() => import("../pages/DecisionLog.jsx"));
const PolicyCompliance = lazy(() => import("../pages/PolicyCompliance.jsx"));
const Settings = lazy(() => import("../pages/Settings.jsx"));
const MembershipRequests = lazy(
  () => import("../pages/MembershipRequests.jsx"),
);
const MembersManagement = lazy(
  () => import("../pages/Admin/MembersManagement.jsx"),
);
const AuditLogViewer = lazy(() => import("../pages/Admin/AuditLogViewer.jsx"));
const AdminHealth = lazy(() => import("../pages/Admin/AdminHealth.jsx"));
const AdminPanel = lazy(() => import("../pages/AdminPanel.jsx"));
const ResourceManagement = lazy(
  () => import("../pages/Admin/ResourceManagement.jsx"),
);
const Bookmarks = lazy(() => import("../pages/Bookmarks.jsx"));
const ActivityFeed = lazy(() => import("../pages/ActivityFeed.jsx"));
const TagBrowser = lazy(() => import("../pages/TagBrowser.jsx"));
const AttendanceAnalytics = lazy(
  () => import("../pages/AttendanceAnalytics.jsx"),
);
const RsvpInbox = lazy(() => import("../pages/RsvpInbox.jsx"));
const MeetingCostAnalytics = lazy(
  () => import("../pages/MeetingCostAnalytics.jsx"),
);
const MeetingInsightsDashboard = lazy(
  () => import("../pages/MeetingInsightsDashboard.jsx"),
);
const EnterpriseMeetingCostEngine = lazy(
  () => import("../pages/EnterpriseMeetingCostEngine.jsx"),
);
const RecapScheduleDashboard = lazy(
  () => import("../pages/RecapScheduleDashboard.jsx"),
);
const MeetingHealthDashboard = lazy(
  () => import("../pages/MeetingHealthDashboard.jsx"),
);
const AutomationRules = lazy(() => import("../pages/AutomationRules.jsx"));
const TopicExplorer = lazy(() => import("../pages/TopicExplorer.jsx"));
const TopicAnalyticsDashboard = lazy(
  () => import("../pages/TopicAnalyticsDashboard.jsx"),
);
const ParkingLotBacklogPage = lazy(
  () => import("../pages/ParkingLotBacklogPage.jsx"),
);
const ConflictResolution = lazy(
  () => import("../pages/ConflictResolution.jsx"),
);
const SpeakingTimeTrends = lazy(
  () => import("../pages/SpeakingTimeTrends.jsx"),
);
const SpeakingTimeCompare = lazy(
  () => import("../pages/SpeakingTimeCompare.jsx"),
);
const Leaderboard = lazy(() => import("../pages/Leaderboard.jsx"));
const Badges = lazy(() => import("../pages/Badges.jsx"));
const ParticipantEngagement = lazy(
  () => import("../pages/ParticipantEngagement.jsx"),
);
const ActionItemAnalytics = lazy(
  () => import("../pages/ActionItemAnalytics.jsx"),
);
const ActionItemsDashboard = lazy(
  () => import("../pages/ActionItemsDashboard.jsx"),
);
const WorkloadDashboard = lazy(() => import("../pages/WorkloadDashboard.jsx"));
const MyDelegations = lazy(() => import("../pages/MyDelegations.jsx"));
const MeetingPatterns = lazy(() => import("../pages/MeetingPatterns.jsx"));
const FocusTime = lazy(() => import("../pages/FocusTime.jsx"));
const SeriesRetrospective = lazy(
  () => import("../pages/SeriesRetrospective.jsx"),
);
const MeetingSeriesList = lazy(() => import("../pages/MeetingSeriesList.jsx"));
const DataRetentionSettings = lazy(
  () => import("../pages/DataRetentionSettings.jsx"),
);
const FollowUpDashboard = lazy(() => import("../pages/FollowUpDashboard.jsx"));
const EscalationDashboard = lazy(
  () => import("../pages/EscalationDashboard.jsx"),
);
const Glossary = lazy(() => import("../pages/Glossary.jsx"));
const StandupReports = lazy(() => import("../pages/StandupReports.jsx"));
const SlaCompliance = lazy(() => import("../pages/SlaCompliance.jsx"));
const TeamAvailability = lazy(() => import("../pages/TeamAvailability.jsx"));
const ActionItemTemplates = lazy(
  () => import("../pages/ActionItemTemplates.jsx"),
);
const OrgTimelineDashboard = lazy(
  () => import("../pages/OrgTimelineDashboard.jsx"),
);
const AbsenteeCatchUpInbox = lazy(
  () => import("../pages/AbsenteeCatchUpInbox.jsx"),
);
const IntegrationMarketplaceHub = lazy(
  () => import("../pages/IntegrationMarketplaceHub.jsx"),
);
const SentimentTrends = lazy(() => import("../pages/SentimentTrends.jsx"));
const AsyncMeetingsDashboard = lazy(
  () => import("../pages/AsyncMeetingsDashboard.jsx"),
);
const MeetingPlaybooks = lazy(() => import("../pages/MeetingPlaybooks.jsx"));
const TopicIntelligence = lazy(() => import("../pages/TopicIntelligence.jsx"));
const SessionGallery = lazy(() => import("../pages/SessionGallery.jsx"));

const ProtectedRoutes = (
  <React.Fragment>
    <Route
      path="/session-cards"
      element={
        <ProtectedRoute>
          <RouteErrorBoundary>
            <SessionGallery />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/session-gallery"
      element={
        <ProtectedRoute>
          <RouteErrorBoundary>
            <SessionGallery />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/topics/analytics"
      element={
        <ProtectedRoute>
          <RouteErrorBoundary>
            <TopicAnalyticsDashboard />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/analytics/topics"
      element={
        <ProtectedRoute>
          <RouteErrorBoundary>
            <TopicAnalyticsDashboard />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/topic-intelligence"
      element={
        <ProtectedRoute>
          <RouteErrorBoundary>
            <TopicIntelligence />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/sentiment-trends"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <SentimentTrends />
        </ProtectedRoute>
      }
    />
    <Route
      path="/analytics/sentiment-trends"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <SentimentTrends />
        </ProtectedRoute>
      }
    />
    <Route
      path="/integrations/marketplace"

      element={
        <ProtectedRoute resource="organizations" action="view">
          <IntegrationMarketplaceHub />
        </ProtectedRoute>
      }
    />
    <Route
      path="/meetings"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <MeetingListPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/playbooks"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <MeetingPlaybooks />
        </ProtectedRoute>
      }
    />
    <Route
      path="/meetings/recycle-bin"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <MeetingRecycleBin />
        </ProtectedRoute>
      }
    />
    <Route
      path="/meetings/compare"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <CompareMeetings />
        </ProtectedRoute>
      }
    />
    <Route
      path="/meeting-series"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <MeetingSeriesList />
        </ProtectedRoute>
      }
    />
    <Route
      path="/meeting-series/:seriesId/retrospective"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <SeriesRetrospective />
        </ProtectedRoute>
      }
    />
    <Route
      path="/knowledge/conflicts"
      element={
        <ProtectedRoute resource="knowledge" action="view">
          <ConflictResolution />
        </ProtectedRoute>
      }
    />
    <Route
      path="/glossary"
      element={
        <ProtectedRoute resource="knowledge" action="view">
          <Glossary />
        </ProtectedRoute>
      }
    />
    <Route
      path="/knowledge/consolidate"
      element={
        <ProtectedRoute resource="knowledge" action="view">
          <MemoryConsolidation />
        </ProtectedRoute>
      }
    />
    <Route
      path="/knowledge/lifecycle"
      element={
        <ProtectedRoute resource="knowledge" action="view">
          <MemoryLifecycle />
        </ProtectedRoute>
      }
    />
    <Route
      path="/knowledge/archive"
      element={
        <ProtectedRoute resource="knowledge" action="view">
          <KnowledgeArchive />
        </ProtectedRoute>
      }
    />
    <Route
      path="/knowledge/graph-history"
      element={
        <ProtectedRoute resource="knowledge" action="view">
          <GraphSnapshots />
        </ProtectedRoute>
      }
    />
    <Route
      path="/knowledge/graph"
      element={
        <ProtectedRoute resource="knowledge" action="view">
          <KnowledgeGraph />
        </ProtectedRoute>
      }
    />
    <Route
      path="/knowledge/:decisionId"
      element={
        <ProtectedRoute>
          <KnowledgeTimeline />
        </ProtectedRoute>
      }
    />
    <Route
      path="/decisions/graph"
      element={
        <ProtectedRoute resource="knowledge" action="view">
          <DecisionGraph />
        </ProtectedRoute>
      }
    />
    <Route
      path="/decision-matrix"
      element={
        <ProtectedRoute resource="knowledge" action="view">
          <DecisionDependencyMatrix />
        </ProtectedRoute>
      }
    />
    <Route
      path="/decision-log"
      element={
        <ProtectedRoute resource="knowledge" action="view">
          <DecisionLog />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/members"
      element={
        <ProtectedRoute resource="team_members" action="view">
          <RouteErrorBoundary section="Admin">
            <MembersManagement />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/audit-logs"
      element={
        <ProtectedRoute resource="audit_logs" action="view">
          <RouteErrorBoundary section="Admin">
            <AuditLogViewer />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/health"
      element={
        <ProtectedRoute
          resource="admin_panel"
          action="view"
          forbiddenFallback={<AccessDenied />}
        >
          <RouteErrorBoundary section="Admin">
            <AdminHealth />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/resources"
      element={
        <ProtectedRoute
          resource="admin_panel"
          action="view"
          forbiddenFallback={<AccessDenied />}
        >
          <RouteErrorBoundary section="Admin">
            <ResourceManagement />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/organizations"
      element={
        <ProtectedRoute>
          <OrganizationHub />
        </ProtectedRoute>
      }
    />
    <Route
      path="/automation-rules"
      element={
        <ProtectedRoute resource="automation_rules" action="view">
          <AutomationRules />
        </ProtectedRoute>
      }
    />
    <Route
      path="/join-organization"
      element={
        <ProtectedRoute>
          <JoinOrganizationPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/browse-organizations"
      element={
        <ProtectedRoute>
          <BrowseOrganizations />
        </ProtectedRoute>
      }
    />
    <Route
      path="/create-organization"
      element={
        <ProtectedRoute>
          <CreateOrganizationPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/organization/settings"
      element={
        <ProtectedRoute resource="organizations" action="view">
          <RouteErrorBoundary section="Org Settings">
            <OrganizationSettings />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/organizations/settings"
      element={
        <ProtectedRoute resource="organizations" action="view">
          <RouteErrorBoundary section="Org Settings">
            <OrganizationSettings />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/organization-settings"
      element={
        <ProtectedRoute resource="organizations" action="view">
          <RouteErrorBoundary section="Org Settings">
            <OrganizationSettings />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/data-retention-settings"
      element={
        <ProtectedRoute resource="organizations" action="view">
          <DataRetentionSettings />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <RouteErrorBoundary section="Dashboard">
            <Dashboard />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/topics"
      element={
        <ProtectedRoute resource="reports" action="view">
          <TopicExplorer />
        </ProtectedRoute>
      }
    />
    <Route
      path="/parking-lot"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <ParkingLotBacklogPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/delegations"
      element={
        <ProtectedRoute>
          <MyDelegations />
        </ProtectedRoute>
      }
    />
    <Route
      path="/focus-time"
      element={
        <ProtectedRoute>
          <FocusTime />
        </ProtectedRoute>
      }
    />
    <Route
      path="/escalations"
      element={
        <ProtectedRoute>
          <EscalationDashboard />
        </ProtectedRoute>
      }
    />

    {/* Feature Routes */}
    <Route
      path="/create-meeting"
      element={
        <ProtectedRoute resource="meetings" action="create">
          <CreateMeeting />
        </ProtectedRoute>
      }
    />
    <Route
      path="/meeting-templates"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <MeetingTemplates />
        </ProtectedRoute>
      }
    />
    <Route
      path="/template-library"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <TemplateLibrary />
        </ProtectedRoute>
      }
    />
    <Route
      path="/upload-meeting"
      element={
        <ProtectedRoute resource="meetings" action="create">
          <UploadMeeting />
        </ProtectedRoute>
      }
    />
    <Route
      path="/policies"
      element={
        <ProtectedRoute resource="policies" action="view">
          <Policies />
        </ProtectedRoute>
      }
    />
    <Route
      path="/summaries"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <Summaries />
        </ProtectedRoute>
      }
    />
    <Route
      path="/reports"
      element={
        <ProtectedRoute resource="reports" action="view">
          <Reports />
        </ProtectedRoute>
      }
    />
    <Route
      path="/reports/weekly-insights"
      element={
        <ProtectedRoute resource="reports" action="view">
          <WeeklyInsights />
        </ProtectedRoute>
      }
    />
    <Route
      path="/reports/builder/:templateId?"
      element={
        <ProtectedRoute resource="reports" action="view">
          <ReportBuilder />
        </ProtectedRoute>
      }
    />
    <Route
      path="/ai-search"
      element={
        <ProtectedRoute resource="ai_search" action="search">
          <AiSearch />
        </ProtectedRoute>
      }
    />
    <Route
      path="/assistant"
      element={
        <ProtectedRoute>
          <AiAssistant />
        </ProtectedRoute>
      }
    />
    <Route
      path="/transcript/:meetingId"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <TranscriptViewer />
        </ProtectedRoute>
      }
    />
    <Route
      path="/meeting/:id"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <RouteErrorBoundary section="Meeting Details">
            <MeetingDetails />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/meeting/:id/briefing"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <MeetingBriefing />
        </ProtectedRoute>
      }
    />
    <Route
      path="/meeting/:id/quality"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <MeetingQuality />
        </ProtectedRoute>
      }
    />
    <Route
      path="/effectiveness/:meetingId?"
      element={
        <ProtectedRoute resource="reports" action="view">
          <MeetingEffectiveness />
        </ProtectedRoute>
      }
    />
    <Route
      path="/meeting-room/:roomId"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <RouteErrorBoundary section="Meeting Room">
            <MeetingRoom />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/team-members"
      element={
        <ProtectedRoute resource="team_members" action="view">
          <TeamMembers />
        </ProtectedRoute>
      }
    />
    <Route
      path="/profile"
      element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      }
    />
    <Route
      path="/calendar"
      element={
        <ProtectedRoute resource="calendar" action="view">
          <Calendar />
        </ProtectedRoute>
      }
    />
    <Route
      path="/notifications"
      element={
        <ProtectedRoute resource="notifications" action="view">
          <Notifications />
        </ProtectedRoute>
      }
    />
    <Route
      path="/tasks"
      element={
        <ProtectedRoute resource="tasks" action="view">
          <Tasks />
        </ProtectedRoute>
      }
    />
    <Route
      path="/action-items"
      element={
        <ProtectedRoute resource="tasks" action="view">
          <ActionItemsDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/workload"
      element={
        <ProtectedRoute resource="tasks" action="view">
          <WorkloadDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/followup"
      element={
        <ProtectedRoute resource="tasks" action="view">
          <FollowUpDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/follow-up-dashboard"
      element={
        <ProtectedRoute resource="tasks" action="view">
          <FollowUpDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/followup-dashboard"
      element={
        <ProtectedRoute resource="tasks" action="view">
          <FollowUpDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/followup/tasks/:id"
      element={
        <ProtectedRoute resource="tasks" action="view">
          <FollowUpDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/timeline"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <OrgTimelineDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/policy-compliance"
      element={
        <ProtectedRoute resource="policies" action="view">
          <PolicyCompliance />
        </ProtectedRoute>
      }
    />
    <Route
      path="/sla-compliance"
      element={
        <ProtectedRoute resource="reports" action="view">
          <SlaCompliance />
        </ProtectedRoute>
      }
    />
    <Route
      path="/action-item-templates"
      element={
        <ProtectedRoute resource="reports" action="view">
          <ActionItemTemplates />
        </ProtectedRoute>
      }
    />
    <Route
      path="/settings"
      element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      }
    />
    <Route
      path="/membership-requests"
      element={
        <ProtectedRoute resource="team_members" action="invite">
          <MembershipRequests />
        </ProtectedRoute>
      }
    />
    <Route
      path="/bookmarks"
      element={
        <ProtectedRoute>
          <Bookmarks />
        </ProtectedRoute>
      }
    />
    <Route
      path="/activities"
      element={
        <ProtectedRoute>
          <ActivityFeed />
        </ProtectedRoute>
      }
    />
    <Route
      path="/tags"
      element={
        <ProtectedRoute>
          <TagBrowser />
        </ProtectedRoute>
      }
    />
    <Route
      path="/attendance-analytics"
      element={
        <ProtectedRoute resource="reports" action="view">
          <AttendanceAnalytics />
        </ProtectedRoute>
      }
    />
    <Route
      path="/meeting-cost-analytics"
      element={
        <ProtectedRoute resource="reports" action="view">
          <MeetingCostAnalytics />
        </ProtectedRoute>
      }
    />
    <Route
      path="/meeting-insights"
      element={
        <ProtectedRoute resource="reports" action="view">
          <MeetingInsightsDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/meeting-cost-engine"
      element={
        <ProtectedRoute resource="reports" action="view">
          <EnterpriseMeetingCostEngine />
        </ProtectedRoute>
      }
    />
    <Route
      path="/action-item-analytics"
      element={
        <ProtectedRoute resource="reports" action="view">
          <ActionItemAnalytics />
        </ProtectedRoute>
      }
    />
    <Route
      path="/memory-telemetry"
      element={
        <ProtectedRoute resource="knowledge" action="view">
          <EnterpriseMemoryTelemetry />
        </ProtectedRoute>
      }
    />
    <Route
      path="/recap-schedule"
      element={
        <ProtectedRoute resource="settings" action="view">
          <RecapScheduleDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/meeting-health"
      element={
        <ProtectedRoute resource="reports" action="view">
          <MeetingHealthDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/speaking-time-trends"
      element={
        <ProtectedRoute resource="reports" action="view">
          <SpeakingTimeTrends />
        </ProtectedRoute>
      }
    />
    <Route
      path="/speaking-time-compare"
      element={
        <ProtectedRoute resource="reports" action="view">
          <SpeakingTimeCompare />
        </ProtectedRoute>
      }
    />
    <Route
      path="/ai-summary-templates"
      element={
        <ProtectedRoute
          resource="admin_panel"
          action="view"
          forbiddenFallback={<AccessDenied />}
        >
          <AiSummaryTemplates />
        </ProtectedRoute>
      }
    />
    <Route path="/access-denied" element={<AccessDenied />} />
    <Route
      path="/leaderboard"
      element={
        <ProtectedRoute>
          <Leaderboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/badges"
      element={
        <ProtectedRoute>
          <Badges />
        </ProtectedRoute>
      }
    />
    <Route
      path="/engagement"
      element={
        <ProtectedRoute resource="reports" action="view">
          <ParticipantEngagement />
        </ProtectedRoute>
      }
    />
    <Route
      path="/patterns"
      element={
        <ProtectedRoute resource="reports" action="view">
          <MeetingPatterns />
        </ProtectedRoute>
      }
    />
    <Route
      path="/standups"
      element={
        <ProtectedRoute resource="reports" action="view">
          <StandupReports />
        </ProtectedRoute>
      }
    />
    <Route
      path="/team-availability"
      element={
        <ProtectedRoute resource="reports" action="view">
          <TeamAvailability />
        </ProtectedRoute>
      }
    />

    <Route
      path="/rsvps"
      element={
        <ProtectedRoute>
          <RsvpInbox />
        </ProtectedRoute>
      }
    />
    <Route
      path="/catch-up"
      element={
        <ProtectedRoute>
          <AbsenteeCatchUpInbox />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin-panel"
      element={
        <ProtectedRoute
          resource="admin_panel"
          action="view"
          forbiddenFallback={<AccessDenied />}
        >
          <RouteErrorBoundary section="Admin">
            <AdminPanel />
          </RouteErrorBoundary>
        </ProtectedRoute>
      }
    />
    <Route
      path="/async-meetings"
      element={
        <ProtectedRoute>
          <AsyncMeetingsDashboard />
        </ProtectedRoute>
      }
    />
  </React.Fragment>
);

export default ProtectedRoutes;
