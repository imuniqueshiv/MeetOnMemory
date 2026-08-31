import {
  SlackConfig,
  NotionConfig,
  GitHubConfig,
  JiraConfig,
  CalendarConfig,
} from "../models/index.js";

/**
 * Aggregates authorization states, sync heartbeat timestamps, and structural metadata
 * across disparate external services into a single marketplace payload.
 * Route: GET /api/v1/integrations/marketplace
 */
export const getMarketplaceStatusAggregation = async (req, res) => {
  const orgId = req.user.orgId || req.user.organizationId || req.user._id; // Adapt to actual user object

  try {
    // Execute concurrent database reads to gather individual connection profiles
    const [slack, notion, github, jira, calendar] = await Promise.all(
      [
        SlackConfig ? SlackConfig.findOne({ orgId }) : null,
        NotionConfig ? NotionConfig.findOne({ orgId }) : null,
        GitHubConfig ? GitHubConfig.findOne({ orgId }) : null,
        JiraConfig ? JiraConfig.findOne({ orgId }) : null,
        CalendarConfig ? CalendarConfig.findOne({ orgId }) : null,
      ].map((p) => p?.catch(() => null)),
    ); // Catch missing models

    const marketplaceCatalog = [
      {
        id: "slack",
        name: "Slack Notification Core",
        category: "Communication",
        description:
          "Broadcast operational real-time updates and trigger action loops inside workspaces.",
        recommendationOrder: 1,
        isConnected: !!(slack && slack.isActive),
        lastSyncedAt: slack?.lastSyncHeartbeat || null,
        configurationRoute: "/organization/settings#slack",
      },
      {
        id: "notion",
        name: "Notion Workspace Sync",
        category: "Knowledge Base",
        description:
          "Export analyzed workspace telemetry, resumes, and reports to team wikis.",
        recommendationOrder: 2,
        isConnected: !!(notion && notion.accessToken),
        lastSyncedAt: notion?.lastSyncHeartbeat || null,
        configurationRoute: "/organization/settings#notion",
      },
      {
        id: "github",
        name: "GitHub Repository Sync",
        category: "Developer Tools",
        description:
          "Link parsing branches and store markdown resumes directly in open source trees.",
        recommendationOrder: 3,
        isConnected: !!(github && github.installationId),
        lastSyncedAt: github?.lastSyncHeartbeat || null,
        configurationRoute: "/organization/settings#github",
      },
      {
        id: "jira",
        name: "Jira Issue Tracker",
        category: "Project Management",
        description:
          "File candidate bug tasks, onboarding tickets, and tracking issues instantly.",
        recommendationOrder: 4,
        isConnected: !!(jira && jira.apiToken),
        lastSyncedAt: jira?.lastSyncHeartbeat || null,
        configurationRoute: "/organization/settings#jira",
      },
      {
        id: "calendar",
        name: "Shared Team Calendar",
        category: "Scheduling",
        description:
          "Coordinate review sessions, technical interviews, and calendar milestone events.",
        recommendationOrder: 5,
        isConnected: !!(calendar && calendar.isAuthorized),
        lastSyncedAt: calendar?.lastSyncHeartbeat || null,
        configurationRoute: "/organization/settings#calendar",
      },
    ];

    // Sort catalog array explicitly by recommended installation order sequence
    marketplaceCatalog.sort(
      (a, b) => a.recommendationOrder - b.recommendationOrder,
    );

    return res.status(200).json({
      success: true,
      orgId,
      integrations: marketplaceCatalog,
    });
  } catch (error) {
    console.error("[MARKETPLACE_AGGREGATOR_ERR]:", error);
    return res.status(500).json({
      success: false,
      message:
        "Failed to safely resolve organization integration status matrices.",
    });
  }
};
