import { logStep, repoRoot, runNpm } from "./changed-files.mjs";

logStep("validate:client", "Running contributor-fast client validation.");
runNpm("run lint:changed", { cwd: `${repoRoot}/client` });
runNpm("run test:related", { cwd: `${repoRoot}/client` });
runNpm("run build:if-needed", { cwd: `${repoRoot}/client` });
