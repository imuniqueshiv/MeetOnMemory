import React, { useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Play, Loader2 } from "lucide-react";
import { getBackendUrl } from "../../config/backendConfig.js";

const METHOD_COLORS = {
  get: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  post: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  put: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  patch:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  delete: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const flattenOperations = (spec) => {
  if (!spec?.paths) return [];
  const rows = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!HTTP_METHODS.has(method)) continue;
      rows.push({
        id: `${method}:${path}`,
        method,
        path,
        summary: operation.summary || `${method.toUpperCase()} ${path}`,
        tag: operation.tags?.[0] || "Api",
        hasBody: Boolean(operation.requestBody),
      });
    }
  }
  return rows.sort((a, b) =>
    `${a.tag}${a.path}${a.method}`.localeCompare(
      `${b.tag}${b.path}${b.method}`,
    ),
  );
};

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

/**
 * Schema-backed endpoint explorer with authenticated Try-It console (#2240).
 */
const OpenApiExplorer = ({ spec, searchQuery = "" }) => {
  const { getToken, isSignedIn } = useAuth();
  const [selectedId, setSelectedId] = useState(null);
  const [requestBody, setRequestBody] = useState("{}");
  const [apiKey, setApiKey] = useState("");
  const [authMode, setAuthMode] = useState("clerk");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const operations = useMemo(() => flattenOperations(spec), [spec]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return operations;
    const q = searchQuery.toLowerCase();
    return operations.filter(
      (op) =>
        op.path.toLowerCase().includes(q) ||
        op.method.includes(q) ||
        op.summary.toLowerCase().includes(q) ||
        op.tag.toLowerCase().includes(q),
    );
  }, [operations, searchQuery]);

  const selected = operations.find((op) => op.id === selectedId) || filtered[0];

  const handleSelect = (op) => {
    setSelectedId(op.id);
    setRequestBody("{}");
    setResponse(null);
    setError(null);
  };

  const handleTryIt = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const headers = { Accept: "application/json" };
      if (authMode === "clerk" && isSignedIn) {
        const token = await getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } else if (authMode === "apiKey" && apiKey.trim()) {
        headers["X-API-Key"] = apiKey.trim();
      }

      const init = { method: selected.method.toUpperCase(), headers };
      if (selected.hasBody && selected.method !== "get") {
        headers["Content-Type"] = "application/json";
        init.body = requestBody.trim() || "{}";
        JSON.parse(init.body);
      }

      const res = await fetch(`${getBackendUrl()}${selected.path}`, init);
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      setResponse({ status: res.status, body });
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  if (!spec) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        OpenAPI spec unavailable.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          {filtered.length} schema-backed operation(s)
        </p>
        {filtered.slice(0, 200).map((op) => (
          <button
            key={op.id}
            type="button"
            onClick={() => handleSelect(op)}
            className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
              selected?.id === op.id
                ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${METHOD_COLORS[op.method] || "bg-slate-100"}`}
              >
                {op.method}
              </span>
              <span className="text-[10px] text-slate-400">{op.tag}</span>
            </div>
            <code className="text-xs font-mono text-slate-800 dark:text-slate-200 break-all">
              {op.path}
            </code>
          </button>
        ))}
        {filtered.length > 200 && (
          <p className="text-xs text-slate-400 px-2">
            Showing first 200 matches. Refine search to narrow results.
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Try It
        </h3>
        {selected ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold uppercase px-2 py-1 rounded ${METHOD_COLORS[selected.method]}`}
              >
                {selected.method}
              </span>
              <code className="text-xs font-mono break-all">
                {selected.path}
              </code>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Authentication
              </label>
              <select
                value={authMode}
                onChange={(e) => setAuthMode(e.target.value)}
                className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
              >
                <option value="clerk">Clerk session (Bearer JWT)</option>
                <option value="apiKey">Organization API key (X-API-Key)</option>
                <option value="none">No auth header</option>
              </select>
              {authMode === "clerk" && !isSignedIn && (
                <p className="text-xs text-amber-600">
                  Sign in to attach your Clerk session token.
                </p>
              )}
              {authMode === "apiKey" && (
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="X-API-Key value"
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800"
                />
              )}
            </div>

            {selected.hasBody && selected.method !== "get" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Request body (JSON)
                </label>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  rows={5}
                  className="w-full text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleTryIt}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              data-testid="openapi-try-it"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Send request
            </button>

            {error && (
              <pre className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg overflow-x-auto">
                {error}
              </pre>
            )}
            {response && (
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Response ({response.status})
                </p>
                <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-64">
                  {typeof response.body === "string"
                    ? response.body
                    : JSON.stringify(response.body, null, 2)}
                </pre>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-500">Select an operation to try.</p>
        )}
      </div>
    </div>
  );
};

export default OpenApiExplorer;
