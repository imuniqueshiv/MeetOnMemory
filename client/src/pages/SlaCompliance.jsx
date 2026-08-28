import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar";
import {
  getSlaBreaches,
  getSlaComplianceStats,
  acknowledgeBreach,
  notifyBreach,
} from "../services/actionItemSlaApi";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiUser,
  FiActivity,
  FiBell,
} from "react-icons/fi";
import { formatDistanceToNow } from "date-fns";
import { toast } from "react-toastify";

const SlaCompliance = () => {
  const { userData } = useContext(AppContent) || {};
  const organizationId =
    userData?.currentOrganization?._id || userData?.currentOrganization;
  const isAdmin = userData?.role === "admin" || userData?.role === "owner";

  const [stats, setStats] = useState(null);
  const [breaches, setBreaches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Assignee drill-down modal states
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [assigneeBreaches, setAssigneeBreaches] = useState([]);
  const [loadingAssigneeData, setLoadingAssigneeData] = useState(false);

  const loadData = React.useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      const [statsData, breachesData] = await Promise.all([
        getSlaComplianceStats(organizationId),
        getSlaBreaches(organizationId),
      ]);
      setStats(statsData);
      setBreaches(breachesData);
    } catch {
      toast.error("Failed to load SLA data");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcknowledge = async (breachId) => {
    try {
      await acknowledgeBreach(breachId);
      toast.success("Breach acknowledged");
      loadData(); // Reload data
      // If modal is open, refresh assignee breaches too
      if (selectedAssignee) {
        openAssigneeDrillDown(selectedAssignee);
      }
    } catch {
      toast.error("Failed to acknowledge breach");
    }
  };

  const handleNotify = async (breachId) => {
    try {
      await notifyBreach(breachId);
      toast.success("Assignee notified about SLA breach");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to notify assignee");
    }
  };

  const openAssigneeDrillDown = async (assignee) => {
    setSelectedAssignee(assignee);
    if (!assignee) return;
    try {
      setLoadingAssigneeData(true);
      const data = await getSlaBreaches(organizationId, {
        assignee: assignee._id || assignee,
      });
      setAssigneeBreaches(data || []);
    } catch {
      toast.error("Failed to load assignee workload");
    } finally {
      setLoadingAssigneeData(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex-1 flex flex-col">
          <Navbar />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-slate-500 animate-pulse">
              Loading compliance data...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  SLA Compliance Dashboard
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Track and manage Action Item Service Level Agreement (SLA)
                  breaches.
                </p>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 mr-4">
                  <FiAlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Total Breaches
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats?.totalBreaches || 0}
                  </p>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400 mr-4">
                  <FiActivity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Open Breaches
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats?.openBreaches || 0}
                  </p>
                </div>
              </div>

              {/* Top Breaching Assignees */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm col-span-1 md:col-span-2">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center">
                  <FiUser className="mr-2" /> Top Breaching Assignees
                </p>
                <div className="space-y-3">
                  {stats?.breachesByAssignee?.length > 0 ? (
                    stats.breachesByAssignee.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                        onClick={() => openAssigneeDrillDown(item.assignee)}
                        data-testid={`assignee-drill-down-${item.assignee?._id || idx}`}
                      >
                        <span className="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
                          {item.assignee ? item.assignee.name : "Unassigned"}
                        </span>
                        <span className="text-xs font-bold px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                          {item.count} breaches
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No breaches found.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Breaches Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Recent SLA Breaches
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Action Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Type & Severity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Assignee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Target vs Actual
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                    {breaches.map((breach) => (
                      <tr
                        key={breach._id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[250px]">
                            {breach.actionItem?.text || "Unknown Action Item"}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                            <span className="flex items-center">
                              <FiClock className="mr-1" />
                              {formatDistanceToNow(new Date(breach.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                            {breach.actionItem?.sourceMeetingId && (
                              <Link
                                to={`/meeting/${breach.actionItem.sourceMeetingId}`}
                                className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold"
                              >
                                View Meeting
                              </Link>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                            {breach.breachType} SLA
                          </div>
                          <div className="flex gap-1.5 mt-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold capitalize
                              ${
                                breach.severity === "critical"
                                  ? "bg-red-150 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-extrabold"
                                  : breach.severity === "high"
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                                    : breach.severity === "medium"
                                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300"
                                      : "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                              }`}
                            >
                              {breach.severity || "low"}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              ({breach.priority})
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900 dark:text-slate-300">
                            {breach.assignee?.name || "Unassigned"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                          <div>Target: {breach.targetHours}h</div>
                          <div className="text-red-600 dark:text-red-400 font-medium">
                            Actual: {breach.actualHours}h
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {breach.status === "open" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                              Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Acknowledged
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex items-center">
                          {breach.status === "open" && (
                            <button
                              onClick={() => handleAcknowledge(breach._id)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 flex items-center cursor-pointer border-0 bg-transparent"
                            >
                              <FiCheckCircle className="mr-1" /> Acknowledge
                            </button>
                          )}
                          {isAdmin && breach.status === "open" && (
                            <button
                              onClick={() => handleNotify(breach._id)}
                              className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 flex items-center ml-4 cursor-pointer border-0 bg-transparent"
                              title="Notify assignee via alert"
                              data-testid={`notify-btn-${breach._id}`}
                            >
                              <FiBell className="mr-1" /> Notify
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {breaches.length === 0 && (
                      <tr>
                        <td
                          colSpan="6"
                          className="px-6 py-8 text-center text-slate-500 dark:text-slate-400"
                        >
                          No SLA breaches found. Great job!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Assignee Drill-Down Workload Modal */}
      {selectedAssignee && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Assignee Workload Detail"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FiUser className="text-indigo-600" /> Workload:{" "}
                {selectedAssignee.name} ({selectedAssignee.email})
              </h3>
              <button
                onClick={() => {
                  setSelectedAssignee(null);
                  setAssigneeBreaches([]);
                }}
                className="text-slate-450 hover:text-slate-650 dark:hover:text-slate-250 border-0 bg-transparent text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto my-4 pr-1">
              {loadingAssigneeData ? (
                <div className="py-12 text-center text-sm text-slate-500 flex justify-center items-center gap-2 animate-pulse">
                  Loading assignee breaches...
                </div>
              ) : assigneeBreaches.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  No active SLA breaches for this assignee.
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">
                    The following action items assigned to this user have
                    breached organizational SLAs:
                  </p>
                  <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-150 dark:divide-slate-700">
                      <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Task
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Severity
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Hours Exceeded
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-150 dark:divide-slate-700">
                        {assigneeBreaches.map((b) => (
                          <tr key={b._id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {b.actionItem?.text}
                              </div>
                              <div className="flex gap-3 mt-1">
                                {b.actionItem?.sourceMeetingId && (
                                  <Link
                                    to={`/meeting/${b.actionItem.sourceMeetingId}`}
                                    className="text-[10px] text-indigo-600 hover:underline font-bold"
                                    onClick={() => setSelectedAssignee(null)}
                                  >
                                    View Meeting
                                  </Link>
                                )}
                                <Link
                                  to="/tasks"
                                  className="text-[10px] text-slate-400 hover:underline font-medium"
                                  onClick={() => setSelectedAssignee(null)}
                                >
                                  Go to Task Board
                                </Link>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold capitalize
                                ${
                                  b.severity === "critical"
                                    ? "bg-red-100 text-red-800"
                                    : b.severity === "high"
                                      ? "bg-orange-100 text-orange-800"
                                      : b.severity === "medium"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-green-100 text-green-800"
                                }`}
                              >
                                {b.severity}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-red-600 font-semibold">
                              {Math.round(b.actualHours)}h / {b.targetHours}h
                              target
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold flex items-center">
                              {b.status === "open" && (
                                <button
                                  onClick={() => handleAcknowledge(b._id)}
                                  className="text-blue-600 hover:text-blue-900 border-0 bg-transparent cursor-pointer p-0 mr-3"
                                >
                                  Acknowledge
                                </button>
                              )}
                              {isAdmin && b.status === "open" && (
                                <button
                                  onClick={() => handleNotify(b._id)}
                                  className="text-orange-600 hover:text-orange-900 border-0 bg-transparent cursor-pointer p-0"
                                  data-testid={`drilldown-notify-btn-${b._id}`}
                                >
                                  Notify
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setSelectedAssignee(null);
                  setAssigneeBreaches([]);
                }}
                className="px-5 py-2 border border-slate-350 dark:border-slate-650 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-0"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlaCompliance;
