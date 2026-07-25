import React, { useState, useEffect, useCallback } from "react";
import {
  Globe,
  Plus,
  Zap,
  Eye,
  EyeOff,
  Copy,
  Check,
  Edit2,
  Trash2,
  List,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Power,
} from "lucide-react";
import { toast } from "react-toastify";
import { webhookApi } from "../services";
import WebhookModal from "./WebhookModal.jsx";
import WebhookDeliveryLogsModal from "./WebhookDeliveryLogsModal.jsx";

const WebhooksManager = ({ organizationId }) => {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);

  const [logsWebhook, setLogsWebhook] = useState(null);
  const [showLogsModal, setShowLogsModal] = useState(false);

  const [visibleSecrets, setVisibleSecrets] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  const fetchWebhooks = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const { data } = await webhookApi.getWebhooks(organizationId);
      if (data.success) {
        setWebhooks(data.webhooks || []);
      }
    } catch (err) {
      console.error("Error fetching webhooks:", err);
      toast.error("Failed to load webhooks.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const toggleSecretVisibility = (id) => {
    setVisibleSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleActive = async (hook) => {
    try {
      const updatedActive = !hook.isActive;
      await webhookApi.updateWebhook(hook._id, { isActive: updatedActive });
      toast.success(
        `Webhook subscription ${updatedActive ? "activated" : "paused"}.`,
      );
      fetchWebhooks();
    } catch (err) {
      console.error("Failed to update webhook status:", err);
      toast.error("Failed to update webhook status.");
    }
  };

  const handleDelete = async (hookId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this webhook subscription?",
      )
    ) {
      return;
    }

    try {
      await webhookApi.deleteWebhook(hookId);
      toast.success("Webhook deleted successfully.");
      fetchWebhooks();
    } catch (err) {
      console.error("Failed to delete webhook:", err);
      toast.error("Failed to delete webhook.");
    }
  };

  const renderHealthBadge = (hook) => {
    const isPaused = !hook.isActive || hook.healthStatus === "paused";
    const isDegraded = hook.healthStatus === "degraded";

    if (isPaused) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
          <XCircle className="w-3.5 h-3.5" /> Paused
        </span>
      );
    }

    if (isDegraded) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5" /> Degraded (
          {hook.consecutiveFailures || 0} fails)
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
      </span>
    );
  };

  if (!organizationId) {
    return (
      <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
        Please select or join an organization to manage webhook subscriptions.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/15">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            <h2 className="text-xl font-bold">Webhook Subscriptions</h2>
          </div>
          <p className="text-xs text-blue-100 max-w-xl">
            Receive event-driven HTTP POST payloads with exponential backoff,
            timestamped HMAC signatures, and Dead-Letter Queue protection.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingWebhook(null);
            setShowModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-blue-600 hover:bg-blue-50 font-semibold text-sm rounded-xl shadow-md transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Webhook
        </button>
      </div>

      {/* Webhook Cards List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <span className="text-sm font-medium">
            Loading webhook subscriptions...
          </span>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-16 px-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/40">
          <Globe className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            No Webhooks Registered
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Add a webhook URL to receive real-time notifications when meetings
            are created, MoMs are generated, or policies change.
          </p>
          <button
            onClick={() => {
              setEditingWebhook(null);
              setShowModal(true);
            }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" /> Register First Webhook
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {webhooks.map((hook) => {
            const isSecretVisible = !!visibleSecrets[hook._id];

            return (
              <div
                key={hook._id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Metadata */}
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
                        <Globe className="w-5 h-5" />
                      </div>
                      <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white truncate max-w-lg">
                        {hook.targetUrl}
                      </span>
                      {renderHealthBadge(hook)}
                    </div>

                    {/* Subscribed Events */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Events:
                      </span>
                      {hook.events?.map((evt) => (
                        <span
                          key={evt}
                          className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        >
                          {evt}
                        </span>
                      ))}
                    </div>

                    {/* Secret Key Display */}
                    {hook.secret && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 font-medium">
                          Secret:
                        </span>
                        <code className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                          {isSecretVisible
                            ? hook.secret
                            : "••••••••••••••••••••••••••••••••"}
                        </code>
                        <button
                          onClick={() => toggleSecretVisibility(hook._id)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title={
                            isSecretVisible ? "Hide Secret" : "Show Secret"
                          }
                        >
                          {isSecretVisible ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(hook.secret, hook._id)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Copy Secret"
                        >
                          {copiedId === hook._id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800 shrink-0">
                    <button
                      onClick={() => {
                        setLogsWebhook(hook);
                        setShowLogsModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
                    >
                      <List className="w-3.5 h-3.5" /> View Logs
                    </button>

                    <button
                      onClick={() => {
                        setEditingWebhook(hook);
                        setShowModal(true);
                      }}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit Webhook"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleToggleActive(hook)}
                      className={`p-2 rounded-xl transition-colors ${
                        hook.isActive
                          ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                      title={
                        hook.isActive ? "Pause Webhook" : "Activate Webhook"
                      }
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(hook._id)}
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete Webhook"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <WebhookModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        webhook={editingWebhook}
        organizationId={organizationId}
        onSuccess={fetchWebhooks}
      />

      <WebhookDeliveryLogsModal
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
        webhook={logsWebhook}
      />
    </div>
  );
};

export default WebhooksManager;
