import React, { useState, useEffect } from "react";
import { X, Globe, Lock, Shield, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { webhookApi } from "../services";

const AVAILABLE_EVENTS = [
  {
    id: "meeting.created",
    label: "Meeting Created",
    desc: "Fired when a new meeting is scheduled or uploaded.",
  },
  {
    id: "mom.generated",
    label: "Minutes of Meeting Ready",
    desc: "Fired when AI finishes generating structured MoM.",
  },
  {
    id: "policy.updated",
    label: "Policy Updated",
    desc: "Fired when organization compliance policies are modified.",
  },
];

const WebhookModal = ({
  isOpen,
  onClose,
  webhook = null,
  organizationId,
  onSuccess,
}) => {
  const isEdit = !!webhook;

  const [targetUrl, setTargetUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState([
    "meeting.created",
    "mom.generated",
  ]);
  const [secret, setSecret] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (webhook) {
      setTargetUrl(webhook.targetUrl || "");
      setSelectedEvents(webhook.events || ["meeting.created"]);
      setSecret(webhook.secret || "");
      setIsActive(webhook.isActive !== false);
    } else {
      setTargetUrl("");
      setSelectedEvents(["meeting.created", "mom.generated"]);
      setSecret(generateRandomSecret());
      setIsActive(true);
    }
  }, [webhook, isOpen]);

  function generateRandomSecret() {
    const chars = "abcdef0123456789";
    let str = "";
    for (let i = 0; i < 64; i++) {
      str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
  }

  const handleToggleEvent = (eventId) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((e) => e !== eventId)
        : [...prev, eventId],
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!targetUrl.trim()) {
      toast.error("Target URL is required.");
      return;
    }

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      toast.error("Target URL must start with http:// or https://");
      return;
    }

    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event trigger.");
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await webhookApi.updateWebhook(webhook._id, {
          targetUrl: targetUrl.trim(),
          events: selectedEvents,
          secret: secret.trim() || undefined,
          isActive,
        });
        toast.success("Webhook subscription updated successfully!");
      } else {
        await webhookApi.createWebhook({
          organizationId,
          targetUrl: targetUrl.trim(),
          events: selectedEvents,
          secret: secret.trim() || undefined,
        });
        toast.success("Webhook registered successfully!");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to save webhook subscription.";
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
                {isEdit ? "Edit Webhook Subscription" : "Register Webhook"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Receive real-time event payloads to your HTTP endpoint
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Target URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Target Payload URL <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Globe className="w-4 h-4" />
              </div>
              <input
                type="url"
                required
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://api.yourcompany.com/webhooks"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Event Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Event Triggers <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {AVAILABLE_EVENTS.map((evt) => {
                const isChecked = selectedEvents.includes(evt.id);
                return (
                  <div
                    key={evt.id}
                    onClick={() => handleToggleEvent(evt.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/60"
                        : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100/60 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {evt.label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {evt.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Secret Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                HMAC Secret Key
              </label>
              <button
                type="button"
                onClick={() => setSecret(generateRandomSecret())}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Regenerate
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Secret key for signing payloads"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Used to compute signature header{" "}
              <code className="text-slate-700 dark:text-slate-300 font-mono">
                x-meetonmemory-signature
              </code>
            </p>
          </div>

          {/* Active Switch (for Edit mode) */}
          {isEdit && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Enable Webhook Subscription
                </span>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Register Webhook"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WebhookModal;
