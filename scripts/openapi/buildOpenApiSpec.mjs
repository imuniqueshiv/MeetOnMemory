import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const routesDir = join(repoRoot, "server/routes");

const toOpenApiPath = (path) =>
  path.replace(/:([A-Za-z0-9_]+)/g, "{$1}").replace(/\/{2,}/g, "/");

const joinPaths = (mount, routePath) => {
  const base = mount.endsWith("/") ? mount.slice(0, -1) : mount;
  if (!routePath || routePath === "/") return base || "/";
  const suffix = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return toOpenApiPath(`${base}${suffix}`);
};

const tagFromPath = (path) => {
  const segments = path
    .replace(/^\/api\/?/, "")
    .split("/")
    .filter(Boolean);
  if (segments.length === 0) return "Api";
  const first = segments[0];
  return first.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const parseImports = (source) => {
  const importMap = new Map();
  for (const match of source.matchAll(
    /import\s+(?:(\w+)\s*,\s*)?(?:\{[^}]*\}\s+from\s+)?["']\.\/([^"']+)["']/g,
  )) {
    if (match[1]) importMap.set(match[1], match[2]);
  }
  for (const match of source.matchAll(
    /import\s+(\w+)\s+from\s+["']\.\/([^"']+)["']/g,
  )) {
    importMap.set(match[1], match[2]);
  }
  return importMap;
};

const parseIndexMounts = (source) => {
  const importMap = parseImports(source);
  const mounts = [];

  for (const match of source.matchAll(
    /router\.use\(\s*(\[[^\]]+\]|["'][^"']+["'])\s*,\s*(\w+)\s*\)/gs,
  )) {
    const pathsRaw = match[1];
    const moduleName = match[2];
    const moduleFile = importMap.get(moduleName);
    if (!moduleFile) continue;

    const paths = pathsRaw.startsWith("[")
      ? [...pathsRaw.matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
      : [pathsRaw.replace(/["']/g, "")];

    for (const mountPath of paths) {
      mounts.push({ mountPath, moduleFile });
    }
  }

  for (const match of source.matchAll(
    /router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g,
  )) {
    mounts.push({
      mountPath: "",
      moduleFile: null,
      inline: { method: match[1], path: match[2] },
    });
  }

  return mounts;
};

const parseRouteOperations = (source) => {
  const operations = [];
  for (const match of source.matchAll(
    /router\.(get|post|put|patch|delete)\(\s*["']([^"']*)["']/g,
  )) {
    operations.push({ method: match[1], path: match[2] || "/" });
  }
  return operations;
};

const addOperation = (paths, tags, fullPath, method) => {
  tags.add(tagFromPath(fullPath));
  paths[fullPath] ??= {};
  paths[fullPath][method] = {
    tags: [tagFromPath(fullPath)],
    summary: `${method.toUpperCase()} ${fullPath}`,
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: "Success" },
      401: { description: "Unauthorized" },
    },
  };
  if (["post", "put", "patch"].includes(method)) {
    paths[fullPath][method].requestBody = {
      content: { "application/json": { schema: { type: "object" } } },
    };
  }
};

export const buildOpenApiSpec = ({
  indexSource,
  readRouteFile = (file) => readFileSync(join(routesDir, file), "utf8"),
}) => {
  const mounts = parseIndexMounts(indexSource);
  const paths = {};
  const tags = new Set();

  for (const mount of mounts) {
    if (mount.inline) {
      addOperation(
        paths,
        tags,
        toOpenApiPath(mount.inline.path),
        mount.inline.method,
      );
      continue;
    }

    let routeSource;
    try {
      const fileName = mount.moduleFile.endsWith(".js")
        ? mount.moduleFile
        : `${mount.moduleFile}.js`;
      routeSource = readRouteFile(fileName);
    } catch {
      continue;
    }

    for (const op of parseRouteOperations(routeSource)) {
      addOperation(paths, tags, joinPaths(mount.mountPath, op.path), op.method);
    }
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "MeetOnMemory API",
      version: "1.0.0",
      description:
        "Auto-generated from Express route mounts. Authenticate with Clerk session JWT (Bearer) or org API key when available.",
    },
    servers: [
      { url: "http://localhost:4000", description: "Local development" },
    ],
    tags: [...tags].sort().map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Clerk session JWT",
        },
        apiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "Organization API key (when enabled)",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  };
};

export const generateOpenApiFromIndex = (indexSource) =>
  buildOpenApiSpec({ indexSource });
