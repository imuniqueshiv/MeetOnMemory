import path from "node:path";
import {
  FORMAT_REGEX,
  logStep,
  repoRoot,
  runPrettierCheck,
  selectChangedFiles,
} from "./changed-files.mjs";

const scope = process.argv[2];
if (!scope) {
  throw new Error(
    "Usage: node scripts/validation/run-prettier-changed.mjs <client|server>",
  );
}

const prefix = `${scope}/`;
const selected = selectChangedFiles(FORMAT_REGEX, prefix);
const scopedFiles = selected.map((file) => file.slice(prefix.length));

if (scopedFiles.length === 0) {
  logStep(`format:${scope}`, `No changed ${scope} files require formatting checks.`);
  process.exit(0);
}

runPrettierCheck(scopedFiles, {
  cwd: path.join(repoRoot, scope),
  label: `format:${scope}`,
});
