import React from "react";
import { Route } from "react-router-dom";

import ProtectedRoute from "../components/ProtectedRoute.jsx";
import AccessDenied from "../pages/AccessDenied.jsx";

// --- Protected Pages ---
import MeetingListPage from "../pages/MeetingListPage.jsx";
import OrganizationHub from "../pages/OrganizationHub.jsx";
import JoinOrganizationPage from "../pages/JoinOrganizationPage.jsx";
import CreateOrganizationPage from "../pages/CreateOrganizationPage.jsx";
import BrowseOrganizations from "../pages/BrowseOrganizations/BrowseOrganizations.jsx";
import OrganizationSettings from "../pages/OrganizationSettings.jsx";
import Dashboard from "../pages/Dashboard.jsx";

// Feature Pages
import CompareMeetings from "../pages/MeetingComparison";
import CreateMeeting from "../pages/CreateMeeting.jsx";
import MeetingTemplates from "../pages/MeetingTemplates.jsx";
import TemplateLibrary from "../pages/TemplateLibrary.jsx";
import UploadMeeting from "../pages/UploadMeeting.jsx";
import Policies from "../pages/Policies.jsx";
import AiSummaryTemplates from "../pages/AiSummaryTemplates.jsx";
import Summaries from "../pages/Summaries.jsx";
import Reports from "../pages/Reports.jsx";
import WeeklyInsights from "../pages/WeeklyInsights.jsx";
import ReportBuilder from "../pages/ReportBuilder.jsx";
import AiSearch from "../pages/AiSearch.jsx";
import AiAssistant from "../pages/AiAssistant.jsx";
import MeetingDetails from "../pages/MeetingDetails.jsx";
import MeetingBriefing from "../pages/MeetingBriefing.jsx";
import MeetingQuality from "../pages/MeetingQuality.jsx";
import MeetingEffectiveness from "../pages/MeetingEffectiveness.jsx";
import MeetingRecycleBin from "../pages/MeetingRecycleBin.jsx";
import MeetingRoom from "../pages/MeetingRoom.jsx";
import TranscriptViewer from "../pages/TranscriptViewer.jsx";
import TeamMembers from "../pages/TeamMembers.jsx";
import Profile from "../pages/Profile.jsx";
import Calendar from "../pages/Calendar.jsx";
import Notifications from "../pages/Notifications.jsx";
import Tasks from "../pages/Tasks.jsx";
import KnowledgeTimeline from "../pages/KnowledgeTimeline.jsx";
import MemoryConsolidation from "../pages/MemoryConsolidation.jsx";
import MemoryLifecycle from "../pages/MemoryLifecycle.jsx";
import KnowledgeArchive from "../pages/KnowledgeArchive.jsx";
import GraphSnapshots from "../pages/GraphSnapshots.jsx";
import KnowledgeGraph from "../pages/KnowledgeGraph.jsx";
import DecisionGraph from "../pages/DecisionGraph.jsx";
import DecisionLog from "../pages/DecisionLog.jsx";
import PolicyCompliance from "../pages/PolicyCompliance.jsx";
import Settings from "../pages/Settings.jsx";
import MembershipRequests from "../pages/MembershipRequests.jsx";
import MembersManagement from "../pages/Admin/MembersManagement.jsx";
import AuditLogViewer from "../pages/Admin/AuditLogViewer.jsx";
import AdminHealth from "../pages/Admin/AdminHealth.jsx";
import AdminPanel from "../pages/AdminPanel.jsx";
import Bookmarks from "../pages/Bookmarks.jsx";
import ActivityFeed from "../pages/ActivityFeed.jsx";
import TagBrowser from "../pages/TagBrowser.jsx";
import AttendanceAnalytics from "../pages/AttendanceAnalytics.jsx";
import MeetingCostAnalytics from "../pages/MeetingCostAnalytics.jsx";
import RecapScheduleDashboard from "../pages/RecapScheduleDashboard.jsx";
import MeetingHealthDashboard from "../pages/MeetingHealthDashboard.jsx";
import AutomationRules from "../pages/AutomationRules.jsx";
import TopicExplorer from "../pages/TopicExplorer.jsx";
import ConflictResolution from "../pages/ConflictResolution.jsx";
import SpeakingTimeTrends from "../pages/SpeakingTimeTrends.jsx";
import SpeakingTimeCompare from "../pages/SpeakingTimeCompare.jsx";
import Leaderboard from "../pages/Leaderboard.jsx";
import Badges from "../pages/Badges.jsx";
import ParticipantEngagement from "../pages/ParticipantEngagement.jsx";
import ActionItemAnalytics from "../pages/ActionItemAnalytics.jsx";
import ActionItemsDashboard from "../pages/ActionItemsDashboard.jsx";
import WorkloadDashboard from "../pages/WorkloadDashboard.jsx";
import MyDelegations from "../pages/MyDelegations.jsx";
import MeetingPatterns from "../pages/MeetingPatterns.jsx";
import FocusTime from "../pages/FocusTime.jsx";
import SeriesRetrospective from "../pages/SeriesRetrospective.jsx";
import MeetingSeriesList from "../pages/MeetingSeriesList.jsx";
import DataRetentionSettings from "../pages/DataRetentionSettings.jsx";
import FollowUpDashboard from "../pages/FollowUpDashboard.jsx";
import EscalationDashboard from "../pages/EscalationDashboard.jsx";
import Glossary from "../pages/Glossary.jsx";
import StandupReports from "../pages/StandupReports.jsx";
import SlaCompliance from "../pages/SlaCompliance.jsx";
import TeamAvailability from "../pages/TeamAvailability.jsx";
import ActionItemTemplates from "../pages/ActionItemTemplates.jsx";
import MemoryAnalyticsDashboard from "../pages/MemoryAnalyticsDashboard.jsx";

const ProtectedRoutes = (
  <React.Fragment>
    <Route
      path="/meetings"
      element={
        <ProtectedRoute resource="meetings" action="view">
          <MeetingListPage />
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
          <MembersManagement />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/audit-logs"
      element={
        <ProtectedRoute resource="audit_logs" action="view">
          <AuditLogViewer />
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
          <AdminHealth />
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
          <OrganizationSettings />
        </ProtectedRoute>
      }
    />
    <Route
      path="/organizations/settings"
      element={
        <ProtectedRoute resource="organizations" action="view">
          <OrganizationSettings />
        </ProtectedRoute>
      }
    />
    <Route
      path="/organization-settings"
      element={
        <ProtectedRoute resource="organizations" action="view">
          <OrganizationSettings />
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
          <Dashboard />
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
          <MeetingDetails />
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
          <MeetingRoom />
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
      path="/action-item-analytics"
      element={
        <ProtectedRoute resource="reports" action="view">
          <ActionItemAnalytics />
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
      path="/admin-panel"
      element={
        <ProtectedRoute
          resource="admin_panel"
          action="view"
          forbiddenFallback={<AccessDenied />}
        >
          <AdminPanel />
        </ProtectedRoute>
      }
    />

    <Route
      path="/analytics/dashboard"
      element={
        <ProtectedRoute>
          <MemoryAnalyticsDashboard />
        </ProtectedRoute>
      }
    />
  </React.Fragment>
);

export default ProtectedRoutes;
