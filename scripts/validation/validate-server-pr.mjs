import { logStep, repoRoot, runNpm } from "./changed-files.mjs";

logStep("validate:server:pr", "Running PR server validation.");
runNpm("run lint:changed", { cwd: `${repoRoot}/server` });
runNpm("run format:check:changed", { cwd: `${repoRoot}/server` });
