import {
  getChangedFiles,
  logStep,
  quoteFiles,
  repoRoot,
  run,
  runNpx,
} from "./changed-files.mjs";

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
]);
const JEST_RELATED_IGNORE = [
  "tests/integration.test.js",
  "tests/policyComplianceIntegration.test.js",
];

const changedFiles = getChangedFiles();
const serverFiles = changedFiles.filter(
  (file) =>
    file.startsWith("server/") &&
    /\.(js|jsx|ts|tsx)$/.test(file) &&
    !file.includes("/coverage/"),
);

const directTests = serverFiles.filter((file) => TEST_FILE_REGEX.test(file));
const sourceFiles = serverFiles.filter((file) => !directTests.includes(file));
const vitestTests = directTests.filter((file) => VITEST_TEST_FILES.has(file));
const jestTests = directTests.filter((file) => !vitestTests.includes(file));

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

if (sourceFiles.length > 0) {
  const scopedSources = sourceFiles.map((file) => file.slice("server/".length));
  const ignoreArgs = JEST_RELATED_IGNORE.map(
    (pattern) => `--testPathIgnorePatterns="${pattern}"`,
  ).join(" ");

  run(
    `${JEST} --runInBand --findRelatedTests --passWithNoTests ${ignoreArgs} ${quoteFiles(
      scopedSources,
    )}`,
    {
      cwd: serverCwd,
    },
  );

  runNpx(`vitest related --passWithNoTests ${quoteFiles(scopedSources)}`, {
    cwd: serverCwd,
  });
}

if (vitestTests.length > 0) {
  runNpx(
    `vitest run --passWithNoTests ${quoteFiles(
      vitestTests.map((file) => file.slice("server/".length)),
    )}`,
    {
      cwd: serverCwd,
    },
  );
}
