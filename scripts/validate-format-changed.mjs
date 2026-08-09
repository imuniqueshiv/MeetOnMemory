import {
  FORMAT_REGEX,
  logStep,
  runPrettierCheck,
  selectChangedFiles,
} from "./validation/changed-files.mjs";

const selected = selectChangedFiles(FORMAT_REGEX);

logStep(
  "validate:format",
  `Checking ${selected.length} changed file(s) with Prettier...`,
);

if (selected.length === 0) {
  logStep("validate:format", "No changed files require formatting checks.");
  process.exit(0);
}

runPrettierCheck(selected, { label: "validate:format" });
