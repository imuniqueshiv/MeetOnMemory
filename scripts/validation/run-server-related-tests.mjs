import {
  getChangedFiles,
  logStep,
  quoteFiles,
  repoRoot,
  run,
  runNpx,
} from "./changed-files.mjs";
import { existsSync } from "node:fs";
import path from "node:path";

const JEST =
  "node --experimental-vm-modules node_modules/jest/bin/jest.js --forceExit";
const serverCwd = `${repoRoot}/server`;

const TEST_FILE_REGEX = /(\.test\.|\.spec\.|__tests__)/;
const VITEST_TEST_FILES = new Set([
  "server/tests/OrganizationService.test.js",
  "server/tests/InvitationService.test.js",
  "server/tests/organizationController.test.js",
  "server/tests/knowledgeController.test.js",
  "server/tests/transcriptController.test.js",
  "server/tests/meetingDigestService.test.js",
  "server/tests/imageUrl.test.js",
  "server/tests/MeetingService.test.js",
  "server/tests/realtimeClerkAuthPhase4.test.js",
  "server/tests/sharedLinkAnalytics.test.js",
  "server/tests/meetingValidation.test.js",
  "server/tests/e2eeFeatureFlag.test.js",
  "server/tests/sessionController.test.js",
  "server/tests/meetingROIController.test.js",
  "server/tests/aiMeetingNoteController.test.js",
  "server/__tests__/audit.test.js",
]);
const JEST_RELATED_IGNORE = [
  "tests/integration.test.js",
  "tests/policyComplianceIntegration.test.js",
];

const fileExists = (repoRelativePath) =>
  existsSync(path.join(repoRoot, repoRelativePath));

const changedFiles = getChangedFiles();
const serverFiles = changedFiles.filter(
  (file) =>
    file.startsWith("server/") &&
    /\.(js|jsx|ts|tsx)$/.test(file) &&
    !file.includes("/coverage/"),
);

const directTests = serverFiles.filter((file) => TEST_FILE_REGEX.test(file));
const sourceFiles = serverFiles.filter((file) => !directTests.includes(file));
const vitestOwnedSources = new Set([
  "server/services/OrganizationService.js",
  "server/services/InvitationService.js",
  "server/controllers/organizationController.js",
  "server/controllers/knowledgeController.js",
  "server/controllers/transcriptController.js",
  "server/models/transcriptModel.js",
  "server/routes/transcriptRoutes.js",
  "server/routes/meetingRoutes.js",
  "server/models/meetingModel.js",
  "server/middleware/meetingValidation.js",
  "server/controllers/meetingSeriesController.js",
  "server/controllers/meetingController.js",
  "server/controllers/sessionController.js",
  "server/models/sessionCardModel.js",
  "server/routes/sessionRoutes.js",
  "server/controllers/sharedLinkController.js",
  "server/models/sharedLinkModel.js",
  "server/config/express.js",
  "server/services/meetingDigestService.js",
  "server/services/MeetingService.js",
  "server/services/MeetingStorageService.js",
  "server/utils/imageUrl.js",
  "server/models/organizationModel.js",
  "server/utils/transcriptEncryption.js",
  "server/controllers/meetingROIController.js",
  "server/models/meetingROIModel.js",
  "server/routes/meetingROIRoutes.js",
  "server/controllers/aiMeetingNoteController.js",
  "server/models/aiMeetingNoteModel.js",
  "server/routes/aiMeetingNoteRoutes.js",
  "server/controllers/breakoutRoomController.js",
  "server/routes/breakoutRoomRoutes.js",
  "server/services/breakoutRoomService.js",
  "server/models/breakoutRoomModel.js",
  "server/models/BreakoutRoom.js",
  "server/socket/meetingSocket.js",
  "server/controllers/guestAccessController.js",
  "server/routes/guestAccessRoutes.js",
  "server/services/guestAccessService.js",
  "server/models/guestAccessTokenModel.js",
  "server/models/guestFeedbackModel.js",
  "server/models/GuestFeedback.js",
  "server/models/GuestToken.js",
  "server/controllers/resourceBookingController.js",
  "server/routes/resourceBookingRoutes.js",
  "server/services/resourceBookingService.js",
  "server/models/resourceBookingModel.js",
  "server/models/physicalResourceModel.js",
  "server/middleware/authMiddleware.js",
  "server/controllers/keyMomentController.js",
  "server/routes/keyMomentRoutes.js",
feature/persist-danger-zone-audit
 feature/persist-danger-zone-audit
  "server/routes/auditRoutes.js",
  "server/routes/index.js",
]);
const VITEST_SOURCE_TEST_MAP = {
  "server/routes/auditRoutes.js": "server/__tests__/audit.test.js",

 feature/fix-clerk-offline-sync
  "server/routes/index.js",
]);
const VITEST_SOURCE_TEST_MAP = {
 main
  "server/routes/index.js":
    "server/tests/breakoutRoomController.vitest.test.js",

  "server/controllers/standupController.js",
  "server/routes/standupRoutes.js",
  "server/routes/index.js",
]);
const VITEST_SOURCE_TEST_MAP = {
  "server/controllers/standupController.js":
    "server/tests/standupController.vitest.test.js",
  "server/routes/standupRoutes.js":
    "server/tests/standupController.vitest.test.js",
  "server/routes/index.js": "server/tests/standupController.vitest.test.js",
 main
  "server/controllers/breakoutRoomController.js":
    "server/tests/breakoutRoomController.vitest.test.js",
  "server/routes/breakoutRoomRoutes.js":
    "server/tests/breakoutRoomController.vitest.test.js",
  "server/services/breakoutRoomService.js":
    "server/tests/breakoutRoomController.vitest.test.js",
  "server/models/breakoutRoomModel.js":
    "server/tests/breakoutRoomController.vitest.test.js",
  "server/models/BreakoutRoom.js":
    "server/tests/breakoutRoomController.vitest.test.js",
  "server/socket/meetingSocket.js":
    "server/tests/breakoutRoomController.vitest.test.js",
  "server/controllers/guestAccessController.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/routes/guestAccessRoutes.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/services/guestAccessService.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/models/guestAccessTokenModel.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/models/guestFeedbackModel.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/models/GuestFeedback.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/models/GuestToken.js":
    "server/tests/guestAccessController.vitest.test.js",
  "server/controllers/resourceBookingController.js":
    "server/tests/resourceBookingController.vitest.test.js",
  "server/routes/resourceBookingRoutes.js":
    "server/tests/resourceBookingController.vitest.test.js",
  "server/services/resourceBookingService.js":
    "server/tests/resourceBookingController.vitest.test.js",
  "server/models/resourceBookingModel.js":
    "server/tests/resourceBookingController.vitest.test.js",
  "server/models/physicalResourceModel.js":
    "server/tests/resourceBookingController.vitest.test.js",
  "server/controllers/keyMomentController.js":
    "server/tests/keyMomentController.vitest.test.js",
  "server/routes/keyMomentRoutes.js":
    "server/tests/keyMomentController.vitest.test.js",
  "server/models/organizationModel.js":
    "server/tests/OrganizationService.test.js",
  "server/utils/transcriptEncryption.js":
    "server/tests/e2eeFeatureFlag.test.js",
  "server/controllers/meetingROIController.js":
    "server/tests/meetingROIController.test.js",
  "server/models/meetingROIModel.js":
    "server/tests/meetingROIController.test.js",
  "server/routes/meetingROIRoutes.js":
    "server/tests/meetingROIController.test.js",
  "server/controllers/aiMeetingNoteController.js":
    "server/tests/aiMeetingNoteController.test.js",
  "server/models/aiMeetingNoteModel.js":
    "server/tests/aiMeetingNoteController.test.js",
  "server/routes/aiMeetingNoteRoutes.js":
    "server/tests/aiMeetingNoteController.test.js",
  "server/controllers/transcriptController.js":
    "server/tests/transcriptController.test.js",
  "server/models/transcriptModel.js":
    "server/tests/transcriptController.test.js",
  "server/routes/transcriptRoutes.js":
    "server/tests/transcriptController.test.js",
  "server/routes/meetingRoutes.js": "server/tests/transcriptController.test.js",
  "server/models/meetingModel.js": "server/tests/meetingValidation.test.js",
  "server/middleware/meetingValidation.js":
    "server/tests/meetingValidation.test.js",
  "server/controllers/meetingSeriesController.js":
    "server/tests/meetingValidation.test.js",
  "server/controllers/sessionController.js":
    "server/tests/sessionController.test.js",
  "server/models/sessionCardModel.js": "server/tests/sessionController.test.js",
  "server/routes/sessionRoutes.js": "server/tests/sessionController.test.js",
  "server/controllers/meetingController.js":
    "server/tests/MeetingService.test.js",
  "server/services/MeetingService.js": "server/tests/MeetingService.test.js",
  "server/services/MeetingStorageService.js":
    "server/tests/MeetingService.test.js",
  "server/controllers/sharedLinkController.js":
    "server/tests/sharedLinkAnalytics.test.js",
  "server/models/sharedLinkModel.js":
    "server/tests/sharedLinkAnalytics.test.js",
  "server/config/express.js": "server/tests/sharedLinkAnalytics.test.js",
};
// Suites named `*.vitest.test.js` are Vitest-owned by convention and need no
// entry in VITEST_TEST_FILES above (Issue #2575).
const isVitestSuite = (file) =>
  VITEST_TEST_FILES.has(file) || file.endsWith(".vitest.test.js");

const vitestTests = [
  ...directTests.filter(isVitestSuite),
  ...sourceFiles
    .filter((file) => vitestOwnedSources.has(file))
    .map((file) => {
      if (VITEST_SOURCE_TEST_MAP[file]) return VITEST_SOURCE_TEST_MAP[file];
      const base = file.split("/").pop().replace(/\.js$/, "");
      return `server/tests/${base}.test.js`;
    })
    .filter(isVitestSuite),
].filter(fileExists);
const uniqueVitestTests = [...new Set(vitestTests)];
// Skip deleted legacy test files still present in the diff against main.
const jestTests = directTests.filter(
  (file) => !VITEST_TEST_FILES.has(file) && fileExists(file),
);
const jestSources = sourceFiles.filter(
  (file) => !vitestOwnedSources.has(file) && fileExists(file),
);

logStep(
  "test:server:related",
  `Running focused server tests for ${serverFiles.length} changed file(s)...`,
);

if (serverFiles.length === 0) {
  logStep("test:server:related", "No changed server files require tests.");
  process.exit(0);
}

if (jestTests.length > 0) {
  run(
    `${JEST} --runInBand --passWithNoTests ${quoteFiles(
      jestTests.map((file) => file.slice("server/".length)),
    )}`,
    {
      cwd: serverCwd,
    },
  );
}

if (jestSources.length > 0) {
  const scopedSources = jestSources.map((file) => file.slice("server/".length));
  const ignoreArgs = JEST_RELATED_IGNORE.map(
    (pattern) => `--testPathIgnorePatterns=${pattern}`,
  ).join(" ");

  // File paths must immediately follow --findRelatedTests (Jest 30+).
  run(
    `${JEST} --runInBand --passWithNoTests --findRelatedTests ${quoteFiles(
      scopedSources,
    )} ${ignoreArgs}`,
    {
      cwd: serverCwd,
    },
  );

  runNpx(`vitest related --passWithNoTests ${quoteFiles(scopedSources)}`, {
    cwd: serverCwd,
  });
}

if (uniqueVitestTests.length > 0) {
  runNpx(
    `vitest run --passWithNoTests ${quoteFiles(
      uniqueVitestTests.map((file) => file.slice("server/".length)),
    )}`,
    {
      cwd: serverCwd,
    },
  );
}
