#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApiSpec } from "./openapi/buildOpenApiSpec.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = join(repoRoot, "server/routes/index.js");
const outputPath = join(repoRoot, "docs/openapi.json");

const spec = buildOpenApiSpec({
  indexSource: readFileSync(indexPath, "utf8"),
});
writeFileSync(outputPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");

const opCount = Object.values(spec.paths).reduce(
  (sum, methods) => sum + Object.keys(methods).length,
  0,
);
console.log(
  `[generate-openapi] Wrote ${opCount} operations across ${Object.keys(spec.paths).length} paths → docs/openapi.json`,
);
