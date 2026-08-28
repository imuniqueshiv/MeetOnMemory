import React, { useState, useEffect, useCallback } from "react";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Shield,
  Clock,
  AlertTriangle,
  ExternalLink,
  Code,
} from "lucide-react";
import { toast } from "react-toastify";
import apiClient from "../../services/apiClient.js";

const SCOPE_OPTIONS = [
  {
    id: "meetings:read",
    label: "Read Meetings",
    desc: "List and view meeting metadata",
  },
  {
    id: "meetings:write",
    label: "Write Meetings",
    desc: "Create, edit, and organize meetings",
  },
  {
    id: "transcripts:read",
    label: "Read Transcripts",
    desc: "Access full meeting transcripts",
  },
  {
    id: "summaries:read",
    label: "Read Summaries",
    desc: "Fetch AI-generated summaries and MoMs",
  },
  {
    id: "action_items:read",
    label: "Read Action Items",
    desc: "List assigned tasks and owners",
  },
  {
    id: "action_items:write",
    label: "Write Action Items",
    desc: "Update task statuses and owners",
  },
  {
    id: "webhooks:manage",
    label: "Manage Webhooks",
    desc: "Register endpoints for meeting events",
  },
];

const ApiKeyManagement = ({ organizationId }) => {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [selectedScopes, setSelectedScopes] = useState([
    "meetings:read",
    "transcripts:read",
    "summaries:read",
  ]);
  const [creating, setCreating] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/api/api-keys", {
        params: { organizationId },
      });
      if (res.data?.success) {
        setKeys(res.data.apiKeys || []);
      }
    } catch (err) {
      console.error("Failed to fetch API keys", err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      setCreating(true);
      const res = await apiClient.post("/api/api-keys", {
        name: newKeyName,
        organizationId,
        scopes: selectedScopes,
        expiresInDays: Number(expiresInDays),
      });

      if (res.data?.success) {
        setGeneratedSecret(res.data.secretKey);
        fetchKeys();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId) => {
    if (
      !window.confirm(
        "Are you sure you want to revoke this API key? Applications using it will immediately lose access.",
      )
    ) {
      return;
    }

    try {
      const res = await apiClient.delete(`/api/api-keys/${keyId}`);
      if (res.data?.success) {
        toast.success("API key revoked");
        fetchKeys();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to revoke API key");
    }
  };

  const handleRotateKey = async (keyId) => {
    if (
      !window.confirm(
        "Rotating this key will invalidate the old secret immediately. Continue?",
      )
    ) {
      return;
    }

    try {
      const res = await apiClient.post(`/api/api-keys/${keyId}/rotate`);
      if (res.data?.success) {
        setGeneratedSecret(res.data.secretKey);
        setCreateModalOpen(true);
        fetchKeys();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to rotate API key");
    }
  };

  const toggleScope = (scopeId) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeId)
        ? prev.filter((s) => s !== scopeId)
        : [...prev, scopeId],
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Organization API Keys & Personal Access Tokens
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Authenticate developer tools, CI pipelines, and custom agents
                with scoped tokens.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setGeneratedSecret(null);
            setNewKeyName("");
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Generate New Key</span>
        </button>
      </div>

      {/* Keys Table */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
          Loading organization API keys...
        </div>
      ) : keys.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="pb-3">Key Name & Token</th>
                <th className="pb-3">Permissions / Scopes</th>
                <th className="pb-3">Created By</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Expires</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {keys.map((k) => {
                const isRevoked = k.status === "revoked";
                return (
                  <tr
                    key={k._id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition"
                  >
                    <td className="py-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {k.name}
                      </div>
                      <code className="font-mono text-[11px] text-slate-400 mt-0.5 inline-block bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {k.keyPreview}
                      </code>
                    </td>
                    <td className="py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {k.scopes?.map((s) => (
                          <span
                            key={s}
                            className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-mono"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 text-slate-600 dark:text-slate-400">
                      {k.createdBy?.name || "Member"}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isRevoked
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}
                      >
                        {k.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-500">
                      {k.expiresAt
                        ? new Date(k.expiresAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="py-3.5 text-right space-x-2">
                      {!isRevoked && (
                        <button
                          type="button"
                          onClick={() => handleRotateKey(k._id)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 rounded-lg transition"
                          title="Rotate Secret"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!isRevoked && (
                        <button
                          type="button"
                          onClick={() => handleRevokeKey(k._id)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 hover:text-rose-700 rounded-lg transition"
                          title="Revoke Key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-850 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          No API keys created yet. Generate one above to access Developer APIs.
        </div>
      )}

      {/* Create / Secret Reveal Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                {generatedSecret
                  ? "Save Your Secret API Key"
                  : "Generate API Key"}
              </h4>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {generatedSecret ? (
              <div className="p-6 space-y-4 text-xs">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    Make sure to copy your API key now. You will not be able to
                    see it again!
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Your Secret Key
                  </label>
                  <div className="flex items-center gap-2 p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <code className="font-mono text-slate-800 dark:text-slate-200 flex-1 truncate">
                      {generatedSecret}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedSecret);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                        toast.success("API key copied to clipboard");
                      }}
                      className="p-1.5 bg-white dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 transition"
                    >
                      {copiedKey ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 transition cursor-pointer"
                  >
                    Done & Closed
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleCreateKey}
                className="p-6 space-y-4 text-xs"
              >
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Key Name / Identifier
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GitHub CI Automation, Slack Bot, Internal Dashboard"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Expiration Duration
                  </label>
                  <select
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
                  >
                    <option value="30">30 Days</option>
                    <option value="90">90 Days (Recommended)</option>
                    <option value="365">1 Year</option>
                    <option value="0">Never Expires</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    API Scopes & Permissions
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {SCOPE_OPTIONS.map((scope) => (
                      <label
                        key={scope.id}
                        className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedScopes.includes(scope.id)}
                          onChange={() => toggleScope(scope.id)}
                          className="mt-0.5 rounded text-violet-600 focus:ring-violet-500"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {scope.label}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {scope.desc}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newKeyName.trim()}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {creating && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>Create Secret Key</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeyManagement;
