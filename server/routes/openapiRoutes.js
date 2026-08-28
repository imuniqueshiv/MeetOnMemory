import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const openapiPath = join(repoRoot, "docs/openapi.json");

let cachedSpec = null;

const loadSpec = () => {
  if (!cachedSpec) {
    cachedSpec = JSON.parse(readFileSync(openapiPath, "utf8"));
  }
  return cachedSpec;
};

const router = express.Router();

router.get("/openapi.json", (_req, res) => {
  res.type("application/json").send(loadSpec());
});

export default router;
