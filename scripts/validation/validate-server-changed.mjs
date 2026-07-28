import { logStep, repoRoot, runNpm } from "./changed-files.mjs";

logStep("validate:server", "Running contributor-fast server validation.");
runNpm("run lint:changed", { cwd: `${repoRoot}/server` });
runNpm("run test:related", { cwd: `${repoRoot}/server` });
