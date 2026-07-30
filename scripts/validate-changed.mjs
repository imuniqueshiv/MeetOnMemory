import {
  FORMAT_REGEX,
  getChangedFiles,
  logStep,
  runNpm,
} from "./validation/changed-files.mjs";

const files = getChangedFiles();
const has = (regex) => files.some((file) => regex.test(file));

logStep("validate:changed", `Changed files detected: ${files.length}`);
if (files.length === 0) {
  console.log("No changes detected.");
  process.exit(0);
}

if (
  has(FORMAT_REGEX) ||
  has(/^\.github\/workflows\//) ||
  has(/^\.github\/scripts\//)
) {
  runNpm("run format:check:changed");
}

if (has(/^server\//)) {
  runNpm("run validate:server");
}

if (has(/^client\//)) {
  runNpm("run validate:client");
}
