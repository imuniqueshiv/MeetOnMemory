import React, { useState, useEffect } from "react";
import { membershipRequestApi } from "../../services";
import { toast } from "react-toastify";
import {
  Users,
  Clock,
  Check,
  X,
  Loader2,
  FileText,
  Calendar,
  Mail,
  AlertCircle,
} from "lucide-react";

const STATUS_STYLES = {
  pending:
    "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  approved:
    "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  rejected:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  cancelled:
    "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
};

const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const MembershipRequests = ({ organizationId }) => {
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");

  useEffect(() => {
    if (organizationId) {
      fetchRequests();
    }
  }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    filterRequests();
  }, [requests, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data } = await membershipRequestApi.getOrganizationRequests(
        organizationId,
        statusFilter === "all" ? undefined : statusFilter,
      );
      if (data.success) {
        setRequests(data.requests || []);
      } else {
        toast.error(data.message || "Failed to fetch requests");
      }
    } catch (err) {
      console.error("Error fetching requests:", err);
      toast.error(err.response?.data?.message || "Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  const filterRequests = () => {
    if (statusFilter === "all") {
      setFilteredRequests(requests);
    } else {
      setFilteredRequests(
        requests.filter((req) => req.status === statusFilter),
      );
    }
  };

  const handleApprove = async (requestId) => {
    try {
      setActionLoading((prev) => ({ ...prev, [requestId]: true }));
      const { data } = await membershipRequestApi.approveRequest(requestId, {
        reviewNotes,
      });
      if (data.success) {
        toast.success("Membership request approved");
        await fetchRequests();
        setSelectedRequest(null);
        setReviewNotes("");
      } else {
        toast.error(data.message || "Failed to approve request");
      }
    } catch (err) {
      console.error("Error approving request:", err);
      toast.error(err.response?.data?.message || "Failed to approve request");
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const handleReject = async (requestId) => {
    try {
      setActionLoading((prev) => ({ ...prev, [requestId]: true }));
      const { data } = await membershipRequestApi.rejectRequest(requestId, {
        reviewNotes,
      });
      if (data.success) {
        toast.success("Membership request rejected");
        await fetchRequests();
        setSelectedRequest(null);
        setReviewNotes("");
      } else {
        toast.error(data.message || "Failed to reject request");
      }
    } catch (err) {
      console.error("Error rejecting request:", err);
      toast.error(err.response?.data?.message || "Failed to reject request");
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-16 w-16 text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          No Organization Selected
        </h3>
        <p className="text-slate-500 dark:text-slate-400">
          Select an organization to view membership requests
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-600/20">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Membership Requests
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filteredRequests.length}{" "}
              {filteredRequests.length === 1 ? "request" : "requests"}
            </p>
          </div>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-16 w-16 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No {statusFilter === "all" ? "" : STATUS_LABELS[statusFilter]}{" "}
            requests
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            {statusFilter === "pending"
              ? "No pending membership requests to review"
              : "No requests found"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <div
              key={request._id}
              className="group relative flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all"
            >
              {/* User Avatar */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold text-lg">
                {getInitials(request.user?.name)}
              </div>

              {/* Request Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                    {request.user?.name || "Unknown"}
                  </h3>
                  {request.user?.isAccountVerified && (
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  {request.user?.email}
                </p>

                {request.message && (
                  <div className="flex items-start gap-2 mb-2">
                    <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-600 dark:text-slate-300 italic">
                      "{request.message}"
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Requested {formatDate(request.createdAt)}</span>
                  </div>
                  {request.reviewedAt && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Reviewed {formatDate(request.reviewedAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider shrink-0 ${STATUS_STYLES[request.status]}`}
              >
                {request.status === "pending" && <Clock className="h-3 w-3" />}
                {request.status === "approved" && <Check className="h-3 w-3" />}
                {request.status === "rejected" && <X className="h-3 w-3" />}
                {request.status === "cancelled" && <X className="h-3 w-3" />}
                {STATUS_LABELS[request.status]}
              </span>

              {/* Actions */}
              {request.status === "pending" && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedRequest(request)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => setSelectedRequest(request)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
          onClick={() => {
            setSelectedRequest(null);
            setReviewNotes("");
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-xl animate-in zoom-in-95 slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setSelectedRequest(null);
                setReviewNotes("");
              }}
              className="absolute right-4 top-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>

            {/* Modal Content */}
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                Review Membership Request
              </h3>

              {/* Requester Info */}
              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold">
                  {getInitials(selectedRequest.user?.name)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {selectedRequest.user?.name}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedRequest.user?.email}
                  </p>
                </div>
              </div>

              {/* Message */}
              {selectedRequest.message && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Request Message
                  </label>
                  <p className="text-sm text-slate-600 dark:text-slate-300 italic p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    "{selectedRequest.message}"
                  </p>
                </div>
              )}

              {/* Review Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Review Notes (optional)
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about your decision..."
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 dark:text-slate-100 resize-none"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {reviewNotes.length}/500 characters
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove(selectedRequest._id)}
                  disabled={actionLoading[selectedRequest._id]}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {actionLoading[selectedRequest._id] ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Approve
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleReject(selectedRequest._id)}
                  disabled={actionLoading[selectedRequest._id]}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {actionLoading[selectedRequest._id] ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" />
                      Reject
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipRequests;
