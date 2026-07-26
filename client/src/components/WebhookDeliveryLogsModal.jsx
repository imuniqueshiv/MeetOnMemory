import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Zap,
} from "lucide-react";
import { toast } from "react-toastify";
import { webhookApi } from "../services";

const WebhookDeliveryLogsModal = ({ isOpen, onClose, webhook }) => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [redeliveringId, setRedeliveringId] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchDeliveries = useCallback(async () => {
    if (!webhook?._id) return;
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter !== "all") params.status = statusFilter;

      const { data } = await webhookApi.getDeliveries(webhook._id, params);
      if (data.success) {
        setDeliveries(data.deliveries || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error("Fetch delivery logs error:", err);
      toast.error("Failed to load delivery logs.");
    } finally {
      setLoading(false);
    }
  }, [webhook, page, statusFilter]);

  useEffect(() => {
    if (isOpen && webhook) {
      fetchDeliveries();
    }
  }, [isOpen, webhook, fetchDeliveries]);

  const handleRedeliver = async (deliveryId, e) => {
    e.stopPropagation();
    setRedeliveringId(deliveryId);
    try {
      await webhookApi.redeliverPayload(deliveryId);
      toast.success("Payload redelivered successfully!");
      fetchDeliveries();
    } catch (err) {
      const msg = err.response?.data?.message || "Redelivery failed.";
      toast.error(msg);
    } finally {
      setRedeliveringId(null);
    }
  };

  const toggleExpand = (id) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  if (!isOpen || !webhook) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
                Delivery Audit Logs
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-md font-mono">
              {webhook.targetUrl}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchDeliveries}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh Logs"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Status Filter:
            </span>
            {["all", "success", "failed", "dlq"].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                  statusFilter === st
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Log Table Container */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
              <span className="text-sm">Fetching delivery history...</span>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Clock className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No delivery logs recorded yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Triggered events will appear here with execution speed and
                status codes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map((item) => {
                const isExpanded = expandedRow === item._id;
                const isSuccess = item.status === "success";
                const isDlq = item.status === "dlq";

                return (
                  <div
                    key={item._id}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/60 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    {/* Log Header Row */}
                    <div
                      onClick={() => toggleExpand(item._id)}
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {/* Status Icon */}
                        {isSuccess ? (
                          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : isDlq ? (
                          <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                            <XCircle className="w-4 h-4" />
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {item.event}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-mono font-medium ${
                                isSuccess
                                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                  : isDlq
                                    ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                                    : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                              }`}
                            >
                              {item.responseStatus
                                ? `HTTP ${item.responseStatus}`
                                : "Network Error"}
                            </span>
                            {isDlq && (
                              <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-600 text-white uppercase tracking-wider">
                                DLQ
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                            <span>Attempt #{item.attempt}</span>
                            <span>•</span>
                            <span>{item.executionTimeMs || 0} ms</span>
                            <span>•</span>
                            <span>
                              {new Date(item.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleRedeliver(item._id, e)}
                          disabled={redeliveringId === item._id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {redeliveringId === item._id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          Redeliver
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                        {item.errorReason && (
                          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-700 dark:text-rose-300">
                            <strong>Error Details:</strong> {item.errorReason}
                          </div>
                        )}

                        <div>
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                            Dispatched Payload:
                          </div>
                          <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto max-h-48">
                            {JSON.stringify(item.payload, null, 2)}
                          </pre>
                        </div>

                        {item.responseBody && (
                          <div>
                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                              Target Response Body:
                            </div>
                            <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto max-h-48">
                              {item.responseBody}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebhookDeliveryLogsModal;
