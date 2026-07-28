import {
  JS_REGEX,
  logStep,
  runNpx,
  quoteFiles,
  repoRoot,
  selectChangedFiles,
} from "./changed-files.mjs";

const scope = process.argv[2];
if (!scope) {
  throw new Error("Usage: node scripts/validation/run-eslint-changed.mjs <client|server>");
}

const prefix = `${scope}/`;
const selected = selectChangedFiles(JS_REGEX, prefix);
const scopedFiles = selected.map((file) => file.slice(prefix.length));

logStep(
  `lint:${scope}`,
  `Checking ${selected.length} changed ${scope} file(s) with ESLint...`,
);

if (selected.length === 0) {
  logStep(`lint:${scope}`, `No changed ${scope} files require linting.`);
  process.exit(0);
}

runNpx(`eslint ${quoteFiles(scopedFiles)}`, {
  cwd: `${repoRoot}/${scope}`,
});
