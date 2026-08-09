import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function resolveRepoRoot() {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
    }).trim();
  } catch {
    return process.cwd();
  }
}

export const repoRoot = resolveRepoRoot();
export const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
export const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

export const FORMAT_REGEX = /\.(js|jsx|ts|tsx|css|html|json|md|yml|yaml)$/i;
export const JS_REGEX = /\.(js|jsx|ts|tsx)$/i;

function capture(command) {
  return execSync(command, { encoding: "utf8", cwd: repoRoot }).trim();
}

function tryCapture(command) {
  try {
    return capture(command);
  } catch {
    return "";
  }
}

function parseLines(output) {
  if (!output) return [];
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function unique(items) {
  return [...new Set(items)];
}

function escapeRef(ref) {
  return ref.replace(/(["\\`$])/g, "\\$1");
}

export function run(command, options = {}) {
  execSync(command, { stdio: "inherit", cwd: repoRoot, ...options });
}

function hasRef(ref) {
  return Boolean(tryCapture(`git rev-parse --verify "${escapeRef(ref)}"`));
}

function buildRefCandidates() {
  const baseBranch = process.env.GITHUB_BASE_REF?.trim();
  const remoteNames = unique(
    parseLines(tryCapture("git remote"))
      .map((remote) => remote.trim())
      .filter(Boolean),
  );
  const preferredRemotes = unique(["origin", "upstream", ...remoteNames]);
  const candidates = [];

  if (baseBranch) {
    for (const remote of preferredRemotes) {
      candidates.push(`refs/remotes/${remote}/${baseBranch}`);
      candidates.push(`${remote}/${baseBranch}`);
    }
    candidates.push(`refs/heads/${baseBranch}`);
    candidates.push(baseBranch);
  }

  const commonBranches = ["main", "master"];
  for (const branch of commonBranches) {
    for (const remote of preferredRemotes) {
      candidates.push(`refs/remotes/${remote}/${branch}`);
      candidates.push(`${remote}/${branch}`);
    }
    candidates.push(`refs/heads/${branch}`);
    candidates.push(branch);
  }

  for (const remote of preferredRemotes) {
    const remoteHead = tryCapture(
      `git symbolic-ref --quiet "refs/remotes/${escapeRef(remote)}/HEAD"`,
    );
    if (remoteHead) {
      candidates.unshift(remoteHead);
    }
  }

  return unique(candidates);
}

function diffFromBaseRef(baseRef) {
  const mergeBase = tryCapture(`git merge-base HEAD "${escapeRef(baseRef)}"`);
  if (!mergeBase) return [];
  return parseLines(tryCapture(`git diff --name-only "${mergeBase}"...HEAD`));
}

function getWorkingTreeFiles() {
  return parseLines(tryCapture("git diff --name-only"));
}

function getUntrackedFiles() {
  return parseLines(tryCapture("git ls-files --others --exclude-standard"));
}

export function detectBaseRef() {
  for (const candidate of buildRefCandidates()) {
    if (hasRef(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function getChangedFiles() {
  const baseRef = detectBaseRef();
  const branchChanged = baseRef ? diffFromBaseRef(baseRef) : [];
  if (branchChanged.length > 0) return unique(branchChanged);

  const stagedFiles = parseLines(tryCapture("git diff --name-only --cached"));
  if (stagedFiles.length > 0) return unique(stagedFiles);

  const workingTreeFiles = getWorkingTreeFiles();
  const untrackedFiles = getUntrackedFiles();
  return unique([...workingTreeFiles, ...untrackedFiles]);
}

export function selectChangedFiles(regex, prefix = "") {
  return getChangedFiles().filter(
    (file) =>
      (!prefix || file.startsWith(prefix)) &&
      regex.test(file) &&
      existsSync(path.join(repoRoot, file)),
  );
}

export function hasChanged(prefixOrRegex) {
  const files = getChangedFiles();
  if (prefixOrRegex instanceof RegExp) {
    return files.some((file) => prefixOrRegex.test(file));
  }
  return files.some((file) => file.startsWith(prefixOrRegex));
}

export function quoteFiles(files) {
  return files.map((file) => `"${file}"`).join(" ");
}

export function logStep(label, message) {
  console.log(`\x1b[36m[${label}]\x1b[0m ${message}`);
}

export function runNpm(args, options = {}) {
  run(`${npmCommand} ${args}`, options);
}

export function runNpx(args, options = {}) {
  run(`${npxCommand} ${args}`, options);
}

function cleanNpmPrefixEnv(env = process.env) {
  const cleaned = { ...env };
  delete cleaned.npm_config_prefix;
  delete cleaned.NPM_CONFIG_PREFIX;
  return cleaned;
}

export function resolvePrettierCommand() {
  const prettierCjs = path.join(
    repoRoot,
    "node_modules/prettier/bin/prettier.cjs",
  );
  if (existsSync(prettierCjs)) {
    return `node "${prettierCjs}"`;
  }
  return `${npxCommand} --yes prettier`;
}

export function runPrettierCheck(
  files,
  { cwd = repoRoot, label = "format" } = {},
) {
  if (files.length === 0) return;

  logStep(label, `Checking ${files.length} file(s) with Prettier...`);
  run(`${resolvePrettierCommand()} --check ${quoteFiles(files)}`, {
    cwd,
    env: cleanNpmPrefixEnv(),
  });
}
