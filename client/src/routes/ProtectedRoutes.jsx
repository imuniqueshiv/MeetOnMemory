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
import CreateMeeting from "../pages/CreateMeeting.jsx";
import UploadMeeting from "../pages/UploadMeeting.jsx";
import Policies from "../pages/Policies.jsx";
import Summaries from "../pages/Summaries.jsx";
import Reports from "../pages/Reports.jsx";
import AiSearch from "../pages/AiSearch.jsx";
import AiAssistant from "../pages/AiAssistant.jsx";
import MeetingDetails from "../pages/MeetingDetails.jsx";
import TranscriptViewer from "../pages/TranscriptViewer.jsx";
import TeamMembers from "../pages/TeamMembers.jsx";
import Profile from "../pages/Profile.jsx";
import Calendar from "../pages/Calendar.jsx";
import Notifications from "../pages/Notifications.jsx";
import Tasks from "../pages/Tasks.jsx";
import KnowledgeTimeline from "../pages/KnowledgeTimeline.jsx";
import MemoryConsolidation from "../pages/MemoryConsolidation.jsx";
import GraphSnapshots from "../pages/GraphSnapshots.jsx";
import PolicyCompliance from "../pages/PolicyCompliance.jsx";
import Settings from "../pages/Settings.jsx";
import MembershipRequests from "../pages/MembershipRequests.jsx";
import AdminPanel from "../pages/AdminPanel.jsx";

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
      path="/knowledge/:decisionId"
      element={
        <ProtectedRoute>
          <KnowledgeTimeline />
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
      path="/knowledge/graph-history"
      element={
        <ProtectedRoute resource="knowledge" action="view">
          <GraphSnapshots />
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
      path="/dashboard"
      element={
        <ProtectedRoute>
          <Dashboard />
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
      path="/policy-compliance"
      element={
        <ProtectedRoute resource="policies" action="view">
          <PolicyCompliance />
        </ProtectedRoute>
      }
    />
    <Route
      path="/settings"
      element={
        <ProtectedRoute resource="settings" action="view">
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
  </React.Fragment>
);

export default ProtectedRoutes;
