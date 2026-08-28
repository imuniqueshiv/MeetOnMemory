import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  Mail,
  Eye,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  Send,
  RefreshCw,
} from "lucide-react";
import { meetingApi } from "../../services";
import SandboxedHtmlPreview from "../SandboxedHtmlPreview.jsx";
import { isDigestDeliveryDisabledMessage } from "../../utils/digestAccess";

const extractPreviewHtml = (payload) => {
  if (payload == null) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload.html === "string") return payload.html;
  if (typeof payload.data === "string") return payload.data;
  if (typeof payload.data?.html === "string") return payload.data.html;
  return "";
};

const extractPreviewText = (payload, html) => {
  if (payload && typeof payload.text === "string" && payload.text.trim()) {
    return payload.text;
  }
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const DigestActions = ({ meetingId, onStatusUpdate, canManage = true }) => {
  const [loading, setLoading] = useState(false);
  const [fetchingStatus, setFetchingStatus] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [previewText, setPreviewText] = useState("");
  const [previewTab, setPreviewTab] = useState("html");
  const [modalOpen, setModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [statusData, setStatusData] = useState(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [deliveryDisabled, setDeliveryDisabled] = useState("");
  const [actionError, setActionError] = useState("");

  const fetchStatus = useCallback(async () => {
    if (!meetingId) return;

    try {
      setFetchingStatus(true);
      const { data } = await meetingApi.getDigestStatus(meetingId);
      if (data?.success) {
        setStatusData(data.data);
        if (onStatusUpdate) onStatusUpdate(data.data);
      }
    } catch (err) {
      const status = err.response?.status;
      if (status !== 404) {
        console.error("Error fetching digest status:", err);
      }
      setStatusData(null);
    } finally {
      setFetchingStatus(false);
    }
  }, [meetingId, onStatusUpdate]);

  useEffect(() => {
    if (meetingId && canManage) {
      fetchStatus();
    }
  }, [meetingId, canManage, fetchStatus]);

  const handleResend = async () => {
    if (!canManage || !meetingId) return;

    try {
      setLoading(true);
      setActionError("");
      setDeliveryDisabled("");
      const { data } = await meetingApi.resendDigest(meetingId);
      if (data.success) {
        toast.success(data.message || "Email digest resent successfully");
        fetchStatus();
      } else {
        const message = data.message || "Failed to resend email digest";
        if (isDigestDeliveryDisabledMessage(message)) {
          setDeliveryDisabled(message);
        } else {
          setActionError(message);
        }
        toast.error(message);
      }
    } catch (err) {
      console.error("Error resending digest:", err);
      const message =
        err.response?.data?.message || "Failed to resend email digest";
      if (
        err.response?.status === 400 &&
        isDigestDeliveryDisabledMessage(message)
      ) {
        setDeliveryDisabled(message);
      } else {
        setActionError(message);
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!canManage || !meetingId) return;

    try {
      setPreviewLoading(true);
      setPreviewError("");
      setModalOpen(true);
      const response = await meetingApi.previewDigest(meetingId);
      const html = extractPreviewHtml(response.data);
      setPreviewHtml(html || null);
      setPreviewText(extractPreviewText(response.data, html));
      setPreviewTab("html");
      if (!html) {
        setPreviewError("Preview not available.");
      }
    } catch (err) {
      console.error("Error fetching preview:", err);
      const message =
        err.response?.data?.message || "Failed to load digest preview";
      setPreviewError(message);
      toast.error(message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
    }
  };

  if (!canManage) return null;

  return (
    <div
      data-testid="digest-actions"
      data-meeting-id={meetingId}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-500" />
            Meeting Digest Delivery Status
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor email delivery state, view preview, and manually trigger
            resends.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchStatus}
            disabled={fetchingStatus}
            aria-label="Refresh digest status"
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Refresh Status"
          >
            <RefreshCw
              className={`w-4 h-4 ${fetchingStatus ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-blue-600 transition-colors disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-blue-400"
          >
            {previewLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            Preview
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={loading || previewLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Resend Digest
          </button>
        </div>
      </div>

      {fetchingStatus && !statusData && (
        <p
          role="status"
          aria-label="Loading digest status"
          className="text-xs text-slate-500 dark:text-slate-400 animate-pulse"
        >
          Loading digest status...
        </p>
      )}

      {deliveryDisabled && (
        <p
          data-testid="digest-delivery-disabled"
          role="status"
          className="text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2"
        >
          {deliveryDisabled}
        </p>
      )}

      {actionError && (
        <p
          data-testid="digest-actions-error"
          role="alert"
          className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2"
        >
          {actionError}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Current State
            </span>
            <div className="mt-1">
              {renderStatusBadge(statusData?.lastStatus || "pending")}
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Last Delivered
          </span>
          <div className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1">
            {statusData?.lastDeliveredAt
              ? new Date(statusData.lastDeliveredAt).toLocaleString()
              : "No delivery recorded"}
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Deliveries / Failures
            </span>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
              {statusData?.totalDelivered || 0} sent /{" "}
              {statusData?.totalFailed || 0} failed
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            <History className="w-3.5 h-3.5" />
            {historyExpanded ? "Hide" : "History"}
          </button>
        </div>
      </div>

      {historyExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-slate-400" />
            Recent Delivery History
          </h4>

          {statusData?.history?.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800">
              {statusData.history.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {renderStatusBadge(item.status)}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {item.recipient?.email || "Participant"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
                    {item.errorMessage && (
                      <span
                        className="text-rose-500 truncate max-w-[180px]"
                        title={item.errorMessage}
                      >
                        {item.errorMessage}
                      </span>
                    )}
                    <span>
                      {new Date(item.deliveredAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800">
              No previous delivery attempts recorded for this meeting.
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="digest-preview-title"
        >
          <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h3
                id="digest-preview-title"
                className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"
              >
                <Mail className="w-5 h-5 text-blue-500" />
                Email Digest Preview
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close digest preview"
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50 dark:bg-slate-950">
              {previewLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2
                    className="w-8 h-8 animate-spin text-blue-500"
                    aria-label="Loading digest preview"
                  />
                </div>
              ) : previewError && !previewHtml ? (
                <div role="alert" className="text-center text-rose-600 py-12">
                  {previewError}
                </div>
              ) : previewHtml ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewTab("html")}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg ${
                        previewTab === "html"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      HTML
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("text")}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg ${
                        previewTab === "text"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      Text
                    </button>
                  </div>
                  {previewTab === "html" ? (
                    <SandboxedHtmlPreview
                      htmlContent={previewHtml}
                      title="Email Preview"
                    />
                  ) : (
                    <pre
                      data-testid="digest-preview-text"
                      className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                    >
                      {previewText || "No plain-text preview available."}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="text-center text-slate-500 py-12">
                  Preview not available.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DigestActions;
