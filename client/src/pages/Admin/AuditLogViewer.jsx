import React, { useState, useEffect, useContext, useCallback } from "react";
import Navbar from "../../components/Navbar.jsx";
import AppContent from "../../context/AppContent.js";
import { organizationApi } from "../../services";
import { toast } from "react-toastify";
import {
  FileText,
  Filter,
  Calendar,
  User,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Activity,
} from "lucide-react";

const ACTION_COLORS = {
  ORGANIZATION_MEMBER_INVITED:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300",
  ORGANIZATION_INVITE_ACCEPTED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300",
  MEMBER_ROLE_CHANGED:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300",
  MEMBER_REMOVED:
    "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300",
  MEETING_DELETED:
    "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300",
  POLICY_DELETED:
    "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300",
  POLICY_PUBLISHED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300",
};

const AuditLogViewer = () => {
  const { userData } = useContext(AppContent);
  const orgId = userData?.organization?._id || userData?.organization;

  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    action: "",
    startDate: "",
    endDate: "",
  });

  const loadLogs = useCallback(
    async (page = 1, limit = pageSize) => {
      if (!orgId) return;
      setLoading(true);
      try {
        const res = await organizationApi.getAuditLogs(orgId, {
          page,
          limit,
          action: filters.action || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        });

        if (res.data?.success) {
          setLogs(res.data.logs || []);
          setPagination(
            res.data.pagination || {
              page,
              total: res.data.logs?.length || 0,
              pages: Math.ceil((res.data.logs?.length || 0) / limit) || 1,
            },
          );
        }
      } catch (err) {
        console.error("Failed to load audit logs", err);
        toast.error("Failed to load audit logs.");
      } finally {
        setLoading(false);
      }
    },
    [orgId, filters, pageSize],
  );

  useEffect(() => {
    loadLogs(1, pageSize);
  }, [loadLogs, pageSize]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pt-20">
      <Navbar />

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Organization Audit Trail
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Immutable audit record of sensitive administrative actions, role
              changes, and member operations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadLogs(pagination.page, pageSize)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Filter Controls */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter by Action
            </label>
            <input
              type="text"
              name="action"
              placeholder="e.g. MEMBER_ROLE_CHANGED"
              value={filters.action}
              onChange={handleFilterChange}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Start Date
            </label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> End Date
            </label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Fetching audit log entries...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No audit log entries recorded yet for this organization.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Actor</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Target Entity</th>
                    <th className="p-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {logs.map((log) => (
                    <tr
                      key={log._id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs"
                    >
                      <td className="p-4 text-slate-500 font-mono whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {log.actor?.name || log.actor?.email || "System"}
                        </div>
                      </td>
                      <td className="p-4 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            ACTION_COLORS[log.action] ||
                            "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400 font-medium">
                        {log.entity || log.targetType || "—"}
                      </td>
                      <td className="p-4 text-slate-500 font-mono max-w-xs truncate">
                        {JSON.stringify(log.details || log.metadata || {})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination & Page Size Footer (#1306) */}
          {logs.length > 0 && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-500 dark:text-slate-400">
                  Page {pagination.page} of {pagination.pages || 1} (
                  {pagination.total || logs.length} total logs)
                </span>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    aria-label="Select logs per page"
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={pagination.page <= 1}
                  onClick={() => loadLogs(pagination.page - 1, pageSize)}
                  className="p-1.5 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={pagination.page >= (pagination.pages || 1)}
                  onClick={() => loadLogs(pagination.page + 1, pageSize)}
                  className="p-1.5 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogViewer;
