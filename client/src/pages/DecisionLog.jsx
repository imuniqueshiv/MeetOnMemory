import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  getDecisionLog,
  getDecisionTimeline,
  updateDecisionOutcome,
  createDecisionLogEntry,
  updateDecisionLogEntry,
  deleteDecisionLogEntry,
  exportDecisionLog,
} from "../services/decisionLogApi";
import { meetingApi } from "../services/meetingApi";
import { organizationApi } from "../services/organizationApi";
import { useRBAC } from "../hooks/useRBAC";
import Navbar from "../components/Navbar.jsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Plus,
  Download,
  Edit3,
  Trash2,
  Calendar,
  FileText,
  CheckCircle2,
} from "lucide-react";

const OutcomeBadge = ({ outcome }) => {
  const colors = {
    implemented:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    reversed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    deferred:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    pending: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    superseded:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${
        colors[outcome] || colors.pending
      }`}
    >
      {outcome}
    </span>
  );
};

const DecisionLog = () => {
  const { hasPermission } = useRBAC();
  const canEdit = hasPermission("knowledge", "edit");

  const [log, setLog] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  // Modals & Forms State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [members, setMembers] = useState([]);
  const [formData, setFormData] = useState({
    text: "",
    outcome: "pending",
    meetingId: "",
    decidedBy: "",
    reviewDate: "",
    tags: "",
    impactAssessment: "",
  });

  const fetchLog = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDecisionLog({ page, outcome: outcomeFilter });
      setLog(data.entries || []);
    } catch (error) {
      console.error("Failed to fetch decision log", error);
    } finally {
      setLoading(false);
    }
  }, [page, outcomeFilter]);

  const fetchTimeline = useCallback(async () => {
    try {
      const data = await getDecisionTimeline();
      setTimeline(data || []);
    } catch (error) {
      console.error("Failed to fetch timeline", error);
    }
  }, []);

  const loadMetadata = useCallback(async () => {
    try {
      const meetingsRes = await meetingApi.getAllMeetings({ limit: 100 });
      setMeetings(meetingsRes.data?.meetings || meetingsRes.meetings || []);

      const membersRes = await organizationApi.getMembers();
      setMembers(membersRes.data || membersRes || []);
    } catch (error) {
      console.error("Failed to load metadata", error);
    }
  }, []);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  useEffect(() => {
    fetchTimeline();
    loadMetadata();
  }, [fetchTimeline, loadMetadata]);

  const handleOutcomeChange = async (id, newOutcome) => {
    try {
      await updateDecisionOutcome(id, { outcome: newOutcome });
      toast.success("Outcome updated successfully");
      fetchLog();
      fetchTimeline();
    } catch (error) {
      console.error("Failed to update outcome", error);
      toast.error("Failed to update outcome");
    }
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this decision log entry?",
      )
    ) {
      return;
    }
    try {
      await deleteDecisionLogEntry(id);
      toast.success("Decision log entry deleted successfully");
      fetchLog();
      fetchTimeline();
    } catch (error) {
      console.error("Failed to delete decision entry", error);
      toast.error("Failed to delete decision entry");
    }
  };

  const handleExport = async (format) => {
    try {
      const data = await exportDecisionLog(format);
      if (format === "csv") {
        const blob = new Blob([data], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `decision-log-${new Date().toISOString().split("T")[0]}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const str = JSON.stringify(data, null, 2);
        const blob = new Blob([str], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute(
          "download",
          `decision-log-${new Date().toISOString().split("T")[0]}.json`,
        );
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      toast.success(`Exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Export failed", error);
      toast.error("Export failed");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataPayload = {
        text: formData.text,
        outcome: formData.outcome,
        meetingId: formData.meetingId || undefined,
        decidedBy: formData.decidedBy || undefined,
        reviewDate: formData.reviewDate ? new Date(formData.reviewDate) : null,
        tags: formData.tags
          ? formData.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        impactAssessment: formData.impactAssessment,
      };

      if (editingEntry) {
        await updateDecisionLogEntry(editingEntry._id, dataPayload);
        toast.success("Decision log entry updated successfully");
      } else {
        await createDecisionLogEntry(dataPayload);
        toast.success("Decision log entry created successfully");
      }
      setIsModalOpen(false);
      setEditingEntry(null);
      fetchLog();
      fetchTimeline();
    } catch (error) {
      console.error("Failed to save decision entry", error);
      toast.error("Failed to save decision entry");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Title and Filter Panel */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Decision Log
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Authoritative record of architecture, design, and strategic team
              decisions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Outcome Filter */}
            <select
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
            >
              <option value="">All Outcomes</option>
              <option value="implemented">Implemented</option>
              <option value="reversed">Reversed</option>
              <option value="deferred">Deferred</option>
              <option value="pending">Pending</option>
              <option value="superseded">Superseded</option>
            </select>

            {/* CSV Export */}
            <button
              onClick={() => handleExport("csv")}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              title="Export to CSV"
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </button>

            {/* JSON Export */}
            <button
              onClick={() => handleExport("json")}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              title="Export to JSON"
            >
              <Download className="w-4 h-4 mr-2" />
              JSON
            </button>

            {/* Create Trigger */}
            {canEdit && (
              <button
                onClick={() => {
                  setEditingEntry(null);
                  setFormData({
                    text: "",
                    outcome: "pending",
                    meetingId: "",
                    decidedBy: "",
                    reviewDate: "",
                    tags: "",
                    impactAssessment: "",
                  });
                  setIsModalOpen(true);
                }}
                className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Decision
              </button>
            )}
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm h-72">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Decision Timeline
          </h2>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={timeline}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E5E7EB"
              />
              <XAxis dataKey="monthYear" tickLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(229, 231, 235, 0.2)" }} />
              <Legend />
              <Bar
                dataKey="implemented"
                stackId="a"
                fill="#10B981"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="pending"
                stackId="a"
                fill="#9CA3AF"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="deferred"
                stackId="a"
                fill="#F59E0B"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="reversed"
                stackId="a"
                fill="#EF4444"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="superseded"
                stackId="a"
                fill="#8B5CF6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Decision Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Decision
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Meeting
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Decided By
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Outcome
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td
                    colSpan="6"
                    className="text-center py-12 text-gray-500 dark:text-gray-400"
                  >
                    <LoaderSpinner />
                  </td>
                </tr>
              ) : log.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="text-center py-12 text-gray-500 dark:text-gray-400"
                  >
                    No decisions recorded.
                  </td>
                </tr>
              ) : (
                log.map((entry) => (
                  <React.Fragment key={entry._id}>
                    <tr
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition"
                      onClick={() =>
                        setExpandedId(
                          expandedId === entry._id ? null : entry._id,
                        )
                      }
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white max-w-xs truncate">
                        {entry.decisionId?.text || "Unknown Decision"}
                      </td>
                      <td className="px-6 py-4 text-sm text-indigo-600 dark:text-indigo-400">
                        {entry.meetingId ? (
                          <Link
                            to={`/meeting/${entry.meetingId._id || entry.meetingId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:underline font-medium"
                          >
                            {entry.meetingId.title || "View Meeting"}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {entry.decidedBy?.name || "Unknown User"}
                      </td>
                      <td className="px-6 py-4">
                        <OutcomeBadge outcome={entry.outcome} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium space-x-3">
                        {canEdit && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEntry(entry);
                                setFormData({
                                  text: entry.decisionId?.text || "",
                                  outcome: entry.outcome || "pending",
                                  meetingId:
                                    entry.meetingId?._id ||
                                    entry.meetingId ||
                                    "",
                                  decidedBy:
                                    entry.decidedBy?._id ||
                                    entry.decidedBy ||
                                    "",
                                  reviewDate: entry.reviewDate
                                    ? new Date(entry.reviewDate)
                                        .toISOString()
                                        .split("T")[0]
                                    : "",
                                  tags: (entry.tags || []).join(", "),
                                  impactAssessment:
                                    entry.impactAssessment || "",
                                });
                                setIsModalOpen(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                              title="Edit Decision"
                            >
                              <Edit3 className="w-4 h-4 inline" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(entry._id);
                              }}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              title="Delete Decision"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {/* Expanded Detail Panel */}
                    {expandedId === entry._id && (
                      <tr className="bg-gray-50/50 dark:bg-gray-800/20 border-b dark:border-gray-800">
                        <td colSpan="6" className="px-6 py-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                                Decision Impact & Tags
                              </h4>
                              <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold block mb-1">
                                  Impact Assessment
                                </span>
                                <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
                                  {entry.impactAssessment ||
                                    "No impact assessment provided."}
                                </p>
                              </div>
                              {entry.tags?.length > 0 && (
                                <div>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 font-bold block mb-1.5">
                                    Tags
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {entry.tags.map((tag, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-md font-medium"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="space-y-4">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                                Execution & Tasks
                              </h4>
                              {entry.reviewDate && (
                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                  <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
                                  <span>
                                    Review Scheduled:{" "}
                                    {new Date(
                                      entry.reviewDate,
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              )}

                              <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold block mb-1.5">
                                  Linked Action Items
                                </span>
                                {entry.linkedActionItems?.length > 0 ? (
                                  <ul className="space-y-2">
                                    {entry.linkedActionItems.map((item) => (
                                      <li
                                        key={item._id}
                                        className="flex items-center justify-between bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 text-sm"
                                      >
                                        <div className="flex items-center">
                                          <FileText className="w-4 h-4 mr-2 text-gray-400" />
                                          <span className="font-medium text-gray-700 dark:text-gray-300">
                                            {item.text}
                                          </span>
                                        </div>
                                        <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded uppercase">
                                          {item.status}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-gray-400">
                                    No action items linked.
                                  </p>
                                )}
                              </div>

                              {canEdit && (
                                <div>
                                  <label className="text-xs text-gray-500 dark:text-gray-400 font-bold block mb-1">
                                    Quick Transition Outcome
                                  </label>
                                  <select
                                    className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-lg p-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={entry.outcome}
                                    onChange={(e) =>
                                      handleOutcomeChange(
                                        entry._id,
                                        e.target.value,
                                      )
                                    }
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="implemented">
                                      Implemented
                                    </option>
                                    <option value="reversed">Reversed</option>
                                    <option value="deferred">Deferred</option>
                                    <option value="superseded">
                                      Superseded
                                    </option>
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="p-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/50">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 text-sm font-semibold border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Page {page}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={log.length < 20}
              className="px-4 py-2 text-sm font-semibold border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {/* Modal: Create/Edit Entry */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 relative my-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {editingEntry ? "Edit Decision Entry" : "Create Decision Entry"}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Decision Text
                  </label>
                  <textarea
                    required
                    rows={3}
                    className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter details of the decision made..."
                    value={formData.text}
                    onChange={(e) =>
                      setFormData({ ...formData, text: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Outcome
                    </label>
                    <select
                      className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.outcome}
                      onChange={(e) =>
                        setFormData({ ...formData, outcome: e.target.value })
                      }
                    >
                      <option value="pending">Pending</option>
                      <option value="implemented">Implemented</option>
                      <option value="reversed">Reversed</option>
                      <option value="deferred">Deferred</option>
                      <option value="superseded">Superseded</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Review Date
                    </label>
                    <input
                      type="date"
                      className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.reviewDate}
                      onChange={(e) =>
                        setFormData({ ...formData, reviewDate: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Link Meeting
                    </label>
                    <select
                      className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.meetingId}
                      onChange={(e) =>
                        setFormData({ ...formData, meetingId: e.target.value })
                      }
                    >
                      <option value="">Select Meeting...</option>
                      {meetings.map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Decided By
                    </label>
                    <select
                      className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.decidedBy}
                      onChange={(e) =>
                        setFormData({ ...formData, decidedBy: e.target.value })
                      }
                    >
                      <option value="">Select User...</option>
                      {members.map((mem) => {
                        const userObj = mem.user || mem;
                        return (
                          <option key={userObj._id} value={userObj._id}>
                            {userObj.name} ({userObj.email})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. core, architecture, security"
                    value={formData.tags}
                    onChange={(e) =>
                      setFormData({ ...formData, tags: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Impact Assessment
                  </label>
                  <textarea
                    rows={2}
                    className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Explain structural or timeline impacts of this decision..."
                    value={formData.impactAssessment}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        impactAssessment: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingEntry(null);
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const LoaderSpinner = () => (
  <div className="flex justify-center items-center py-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
  </div>
);

export default DecisionLog;
