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
const vitestOwnedSources = new Set([
  "server/services/OrganizationService.js",
  "server/services/InvitationService.js",
  "server/controllers/organizationController.js",
  "server/controllers/knowledgeController.js",
  "server/controllers/transcriptController.js",
  "server/services/meetingDigestService.js",
  "server/utils/imageUrl.js",
]);
const vitestTests = [
  ...directTests.filter((file) => VITEST_TEST_FILES.has(file)),
  ...sourceFiles
    .filter((file) => vitestOwnedSources.has(file))
    .map((file) => {
      const base = file.split("/").pop().replace(/\.js$/, "");
      return `server/tests/${base}.test.js`;
    })
    .filter((file) => VITEST_TEST_FILES.has(file)),
];
const uniqueVitestTests = [...new Set(vitestTests)];
const jestTests = directTests.filter((file) => !VITEST_TEST_FILES.has(file));
const jestSources = sourceFiles.filter((file) => !vitestOwnedSources.has(file));

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
