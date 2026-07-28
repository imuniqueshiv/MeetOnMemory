import { getChangedFiles, logStep, repoRoot, runNpm } from "./changed-files.mjs";

const BUILD_TRIGGER_PATTERNS = [
  /^client\/src\//,
  /^client\/public\//,
  /^client\/package\.json$/,
  /^client\/package-lock\.json$/,
  /^client\/vite\.config\./,
  /^package\.json$/,
  /^package-lock\.json$/,
];

const changedFiles = getChangedFiles();
const shouldBuild = changedFiles.some((file) =>
  BUILD_TRIGGER_PATTERNS.some((pattern) => pattern.test(file)),
);

if (!shouldBuild) {
  logStep(
    "build:client",
    "Skipping frontend build because no build-affecting files changed.",
  );
  process.exit(0);
}

logStep("build:client", "Running frontend build for build-affecting changes.");
runNpm("run build", { cwd: `${repoRoot}/client` });
