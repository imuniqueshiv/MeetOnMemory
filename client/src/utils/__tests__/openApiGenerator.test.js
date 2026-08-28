import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildOpenApiSpec } from "../../../../scripts/openapi/buildOpenApiSpec.mjs";

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

describe("OpenAPI generator (#2240)", () => {
  const indexSource = readFileSync(
    join(repoRoot, "server/routes/index.js"),
    "utf8",
  );

  it("builds paths for major /api route groups", () => {
    const spec = buildOpenApiSpec({ indexSource });
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.paths["/api/auth/is-auth"]?.get).toBeDefined();
    expect(spec.paths["/api/glossary"]?.get).toBeDefined();
    expect(spec.paths["/api/assistant/sessions"]?.post).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
  });

  it("committed docs/openapi.json matches generator output", () => {
    const expected = buildOpenApiSpec({ indexSource });
    const committed = JSON.parse(
      readFileSync(join(repoRoot, "docs/openapi.json"), "utf8"),
    );
    expect(committed.paths).toEqual(expected.paths);
  });
});
