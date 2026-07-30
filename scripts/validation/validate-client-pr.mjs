import { logStep, repoRoot, runNpm } from "./changed-files.mjs";

logStep("validate:client:pr", "Running PR client validation.");
runNpm("run lint:changed", { cwd: `${repoRoot}/client` });
runNpm("run format:check:changed", { cwd: `${repoRoot}/client` });
runNpm("run build", { cwd: `${repoRoot}/client` });
