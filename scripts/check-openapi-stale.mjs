#!/usr/bin/env node
/**
 * Fail when docs/openapi.json is stale vs route mounts (#2240).
 */
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApiSpec } from "./openapi/buildOpenApiSpec.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = join(repoRoot, "server/routes/index.js");
const openapiPath = join(repoRoot, "docs/openapi.json");

const expected = buildOpenApiSpec({
  indexSource: readFileSync(indexPath, "utf8"),
});
const actual = JSON.parse(readFileSync(openapiPath, "utf8"));

const normalize = (spec) => JSON.stringify(spec, null, 2);

if (normalize(expected) !== normalize(actual)) {
  console.error(
    "[check:openapi] docs/openapi.json is out of date. Run: node scripts/generate-openapi.mjs",
  );
  process.exit(1);
}

console.log("[check:openapi] docs/openapi.json is up to date.");
