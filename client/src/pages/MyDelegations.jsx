import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  Shield,
  Eye,
  Briefcase,
  FileText,
  CheckCircle,
  XCircle,
} from "lucide-react";
import api from "../services/apiClient.js";
import ConfirmModal from "../components/ConfirmModal.jsx";

const MyDelegations = () => {
  const [delegatedByMe, setDelegatedByMe] = useState([]);
  const [delegatedToMe, setDelegatedToMe] = useState([]);
  const [activeTab, setActiveTab] = useState("byMe");
  const [loading, setLoading] = useState(true);

  const [selectedBriefing, setSelectedBriefing] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    id: null,
    action: null,
    title: "",
    message: "",
    variant: "warning",
    confirmText: "",
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDelegations();
  }, []);

  const fetchDelegations = async () => {
    try {
      const response = await api.get("/api/delegations/my-delegations");
      setDelegatedByMe(response?.data?.delegatedByMe || []);
      setDelegatedToMe(response?.data?.delegatedToMe || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch delegations.");
    } finally {
      setLoading(false);
    }
  };

  const promptAction = (id, action) => {
    let title = "";
    let message = "";
    let variant = "warning";
    let confirmText = "";

    if (action === "approve") {
      title = "Approve Delegation Request";
      message =
        "Are you sure you want to approve this delegation request? You will assume responsibility for attending and voting.";
      variant = "warning";
      confirmText = "Approve";
    } else if (action === "reject") {
      title = "Decline Delegation Request";
      message = "Are you sure you want to decline this delegation request?";
      variant = "danger";
      confirmText = "Decline";
    } else if (action === "revoke") {
      title = "Revoke Delegation Request";
      message = "Are you sure you want to revoke this delegation request?";
      variant = "danger";
      confirmText = "Revoke";
    }

    setConfirmModal({
      isOpen: true,
      id,
      action,
      title,
      message,
      variant,
      confirmText,
    });
  };

  const executeAction = async () => {
    const { id, action } = confirmModal;
    if (!id || !action) return;

    setActionLoading(true);
    try {
      await api.post(`/api/delegations/${id}/${action}`);
      toast.success(`Delegation ${action} successfully.`);
      fetchDelegations();
    } catch (err) {
      toast.error(
        err.response?.data?.error || `Failed to ${action} delegation.`,
      );
    } finally {
      setActionLoading(false);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const getScopeIcon = (scope) => {
    switch (scope) {
      case "full":
        return <Shield className="w-4 h-4" />;
      case "action_items":
        return <Briefcase className="w-4 h-4" />;
      case "voting":
        return <Shield className="w-4 h-4" />;
      case "observation":
        return <Eye className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const StatusBadge = ({ status }) => {
    let colors = "bg-gray-100 text-gray-800";
    if (status === "pending") colors = "bg-yellow-100 text-yellow-800";
    if (status === "approved") colors = "bg-green-100 text-green-800";
    if (status === "rejected" || status === "revoked")
      colors = "bg-red-100 text-red-800";
    if (status === "completed") colors = "bg-blue-100 text-blue-800";

    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${colors}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          My Delegations
        </h1>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("byMe")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors cursor-pointer ${
              activeTab === "byMe"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:border-gray-300"
            }`}
          >
            Delegated By Me
          </button>
          <button
            onClick={() => setActiveTab("toMe")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors cursor-pointer ${
              activeTab === "toMe"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:border-gray-300"
            }`}
          >
            Delegated To Me
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {(activeTab === "byMe" ? delegatedByMe : delegatedToMe).length ===
            0 ? (
              <li className="p-8 text-center text-gray-500 dark:text-gray-400">
                No delegations found.
              </li>
            ) : (
              (activeTab === "byMe" ? delegatedByMe : delegatedToMe).map(
                (del) => (
                  <li
                    key={del._id}
                    className="p-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <p className="text-sm font-medium text-blue-600 truncate">
                          {del.meetingId?.title || "Unknown Meeting"}
                        </p>
                        <p className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                          {activeTab === "byMe" ? (
                            <>Delegatee: {del.delegateeId?.name}</>
                          ) : (
                            <>Delegator: {del.delegatorId?.name}</>
                          )}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {del.scope.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                            >
                              {getScopeIcon(s)}
                              <span className="capitalize">
                                {s.replace("_", " ")}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        <StatusBadge status={del.status} />

                        <div className="flex items-center gap-2">
                          {/* Actions for Delegated To Me */}
                          {activeTab === "toMe" && del.status === "pending" && (
                            <>
                              <button
                                onClick={() => promptAction(del._id, "approve")}
                                className="text-green-600 hover:text-green-900 cursor-pointer p-1"
                                title="Accept"
                              >
                                <CheckCircle className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => promptAction(del._id, "reject")}
                                className="text-red-600 hover:text-red-900 cursor-pointer p-1"
                                title="Reject"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </>
                          )}

                          {/* Actions for Delegated By Me */}
                          {activeTab === "byMe" &&
                            (del.status === "pending" ||
                              del.status === "approved") && (
                              <button
                                onClick={() => promptAction(del._id, "revoke")}
                                className="text-xs text-red-600 hover:text-red-900 font-medium cursor-pointer"
                              >
                                Revoke
                              </button>
                            )}

                          {/* View Briefing / Report */}
                          {del.contextBriefing && (
                            <button
                              onClick={() =>
                                setSelectedBriefing(del.contextBriefing)
                              }
                              className="text-xs text-blue-600 hover:text-blue-900 font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-4 h-4" /> Briefing
                            </button>
                          )}
                          {del.postMeetingReport && (
                            <button
                              onClick={() =>
                                setSelectedReport(del.postMeetingReport)
                              }
                              className="text-xs text-purple-600 hover:text-purple-900 font-medium flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-4 h-4" /> Report
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ),
              )
            )}
          </ul>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={executeAction}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText="Cancel"
        isLoading={actionLoading}
        loadingText="Processing..."
        variant={confirmModal.variant}
      />

      {/* Briefing Modal */}
      {selectedBriefing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-4 dark:text-white">
              AI Context Briefing
            </h3>
            <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto pr-2">
              {selectedBriefing}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedBriefing(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-4 dark:text-white">
              AI Post-Meeting Report
            </h3>
            <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto pr-2">
              {selectedReport}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors cursor-pointer"
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

export default MyDelegations;
