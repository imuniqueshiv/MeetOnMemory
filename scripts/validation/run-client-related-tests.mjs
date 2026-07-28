import {
  JS_REGEX,
  getChangedFiles,
  logStep,
  quoteFiles,
  repoRoot,
  runNpx,
} from "./changed-files.mjs";

const changedFiles = getChangedFiles();
const clientFiles = changedFiles.filter(
  (file) =>
    file.startsWith("client/src/") &&
    JS_REGEX.test(file) &&
    !file.includes("/__mocks__/"),
);
const directTests = clientFiles.filter((file) =>
  /(\.test\.|\.spec\.|__tests__)/.test(file),
);
const relatedSources = clientFiles.filter((file) => !directTests.includes(file));

logStep(
  "test:client:related",
  `Running focused client tests for ${clientFiles.length} changed file(s)...`,
);

if (clientFiles.length === 0) {
  logStep("test:client:related", "No changed client source files require tests.");
  process.exit(0);
}

if (directTests.length > 0) {
  runNpx(
    `vitest run --passWithNoTests ${quoteFiles(
      directTests.map((file) => file.slice("client/".length)),
    )}`,
    {
      cwd: `${repoRoot}/client`,
    },
  );
}

if (relatedSources.length > 0) {
  runNpx(
    `vitest related --passWithNoTests ${quoteFiles(
      relatedSources.map((file) => file.slice("client/".length)),
    )}`,
    {
      cwd: `${repoRoot}/client`,
    },
  );
}
