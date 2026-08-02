export default {
  testEnvironment: "node",

  // ESM support — required because the codebase uses `"type": "module"`.
  transform: {},

  // Shared DB lifecycle hooks run before every test file.
  setupFilesAfterEnv: ["./tests/setup.js"],

  // 30 s per test keeps CI green on slow Windows machines where the
  // MongoMemoryServer binary launch and first connection can take >5 s.
  testTimeout: 30000,

  // Vitest-authored suites must not be collected by Jest. Loading them under
  // Jest pulls in @vitest/expect and throws:
  //   TypeError: Cannot redefine property: Symbol($$jest-matchers-object)
  // Run those suites via `npm run test:unit` instead.
  testPathIgnorePatterns: [
    "/node_modules/",
    "organizationController.test.js",
    "InvitationService.test.js",
    "OrganizationService.test.js",
    "knowledgeController.test.js",
    "transcriptController.test.js",
    "meetingDigestService.test.js",
    "clerkRbacIntegration.test.js",
    "decisionGraphOptimized.test.js",
    "sessionAiPermission.test.js",
    "MeetingService.test.js",
    "attendanceAnalyticsOptimized.test.js",
    "calendarSyncOrganization.test.js",
    "pollExpirationBatch.test.js",
    "realtimeClerkAuthPhase4.test.js",
    "voiceSearchTenantIsolation.test.js",
    "sharedLinkAnalytics.test.js",
    "ragAssistantSocketScope.test.js",
    "dashboardController.test.js",
  ],
};
