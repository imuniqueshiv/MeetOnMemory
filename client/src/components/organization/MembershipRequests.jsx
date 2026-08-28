import React, { useState, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
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
  AlertCircle,
  ShieldAlert,
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

  // Multi-select & Bulk Action states
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkModalType, setBulkModalType] = useState(null); // 'approve' | 'reject' | null
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [partialFailureErrors, setPartialFailureErrors] = useState([]);

  const selectAllRef = useRef(null);

  useEffect(() => {
    if (organizationId) {
      fetchRequests();
    }
  }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    filterRequests();
  }, [requests, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset selected IDs when filter or organization changes
  useEffect(() => {
    setSelectedIds([]);
    setPartialFailureErrors([]);
  }, [statusFilter, organizationId]);

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

  // Pending requests in current filtered view that can be bulk acted upon
  const selectablePendingRequests = useMemo(() => {
    return filteredRequests.filter((req) => req.status === "pending");
  }, [filteredRequests]);

  const selectablePendingIds = useMemo(() => {
    return selectablePendingRequests.map((req) => req._id);
  }, [selectablePendingRequests]);

  const isAllSelected = useMemo(() => {
    if (selectablePendingIds.length === 0) return false;
    return selectablePendingIds.every((id) => selectedIds.includes(id));
  }, [selectablePendingIds, selectedIds]);

  const isSomeSelected = useMemo(() => {
    if (selectablePendingIds.length === 0) return false;
    return (
      selectedIds.length > 0 &&
      !isAllSelected &&
      selectablePendingIds.some((id) => selectedIds.includes(id))
    );
  }, [selectablePendingIds, selectedIds, isAllSelected]);

  // Set indeterminate state on select-all checkbox input
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Unselect all currently selectable pending items
      setSelectedIds((prev) =>
        prev.filter((id) => !selectablePendingIds.includes(id)),
      );
    } else {
      // Select all currently selectable pending items
      setSelectedIds((prev) => [
        ...prev,
        ...selectablePendingIds.filter((id) => !prev.includes(id)),
      ]);
    }
  };

  const handleToggleSelect = (requestId) => {
    setSelectedIds((prev) =>
      prev.includes(requestId)
        ? prev.filter((id) => id !== requestId)
        : [...prev, requestId],
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
    setPartialFailureErrors([]);
  };

  // Single Item Actions
  const handleApprove = async (requestId) => {
    try {
      setActionLoading((prev) => ({ ...prev, [requestId]: true }));
      const { data } = await membershipRequestApi.approveRequest(requestId, {
        reviewNotes,
      });
      if (data.success) {
        toast.success("Membership request approved");
        setSelectedIds((prev) => prev.filter((id) => id !== requestId));
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
        setSelectedIds((prev) => prev.filter((id) => id !== requestId));
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

  // Bulk Actions
  const handleExecuteBulkAction = async () => {
    if (!bulkModalType || selectedIds.length === 0 || bulkLoading) return;

    try {
      setBulkLoading(true);
      setPartialFailureErrors([]);

      const isApprove = bulkModalType === "approve";
      const apiFn = isApprove
        ? membershipRequestApi.bulkApproveRequests
        : membershipRequestApi.bulkRejectRequests;

      const res = await apiFn(selectedIds, bulkNotes);
      const resData = res.data?.data || res.data || {};
      const results = resData.results || [];
      const errors = resData.errors || [];

      if (errors.length === 0) {
        toast.success(
          isApprove
            ? `Successfully approved ${results.length || selectedIds.length} request(s)`
            : `Successfully rejected ${results.length || selectedIds.length} request(s)`,
        );
        setSelectedIds([]);
        setBulkModalType(null);
        setBulkNotes("");
      } else {
        // Partial or full failure
        const failedIds = errors.map((e) => e.requestId);
        setPartialFailureErrors(errors);

        if (results.length > 0) {
          toast.warning(
            `${isApprove ? "Approved" : "Rejected"} ${results.length} request(s), but ${errors.length} failed.`,
          );
          // Keep only failed request IDs selected for retry
          setSelectedIds(failedIds);
        } else {
          toast.error(
            `Failed to ${isApprove ? "approve" : "reject"} selected requests: ${errors[0]?.message || "Operation failed"}`,
          );
        }
        setBulkModalType(null);
        setBulkNotes("");
      }

      await fetchRequests();
    } catch (err) {
      console.error(`Error in bulk ${bulkModalType}:`, err);
      const errMsg =
        err.response?.data?.message ||
        `Failed to bulk ${bulkModalType} requests`;
      toast.error(errMsg);
    } finally {
      setBulkLoading(false);
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
    <div className="space-y-6" data-testid="organization-membership-requests">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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
          aria-label="Filter requests by status"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Partial Failure Notification Banner */}
      {partialFailureErrors.length > 0 && (
        <div
          role="alert"
          className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start justify-between gap-3 text-sm text-amber-900 dark:text-amber-200 animate-in fade-in"
        >
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">
                Partial Action Failure ({partialFailureErrors.length} item(s)
                failed)
              </span>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
                {partialFailureErrors.map((err, idx) => (
                  <li key={idx}>
                    {err.message || "Failed to process request"}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPartialFailureErrors([])}
            className="p-1 text-amber-600 hover:text-amber-800 dark:hover:text-amber-100 rounded transition-colors"
            aria-label="Dismiss failure warning"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div
          data-testid="bulk-action-bar"
          className="p-3.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
              {selectedIds.length}
            </span>
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {selectedIds.length === 1
                ? "1 request selected"
                : `${selectedIds.length} requests selected`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBulkModalType("approve");
                setBulkNotes("");
              }}
              disabled={bulkLoading}
              className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              aria-label={`Bulk approve ${selectedIds.length} requests`}
            >
              <Check className="h-4 w-4" />
              <span>Approve ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBulkModalType("reject");
                setBulkNotes("");
              }}
              disabled={bulkLoading}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              aria-label={`Bulk reject ${selectedIds.length} requests`}
            >
              <X className="h-4 w-4" />
              <span>Reject ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              onClick={handleClearSelection}
              disabled={bulkLoading}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Clear selection"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Select All Row Header */}
      {!loading && selectablePendingRequests.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-100/60 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
              aria-label="Select all pending requests"
            />
            <span>
              {isAllSelected
                ? "All Pending Selected"
                : `Select All Pending (${selectablePendingRequests.length})`}
            </span>
          </label>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      )}

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
          {filteredRequests.map((request) => {
            const isPending = request.status === "pending";
            const isSelected = selectedIds.includes(request._id);

            return (
              <div
                key={request._id}
                data-testid={`membership-request-card-${request._id}`}
                className={`group relative flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 ring-1 ring-blue-500"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md"
                }`}
              >
                {/* Row Checkbox for Pending Requests */}
                {isPending && (
                  <div className="flex items-center self-center shrink-0 pr-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(request._id)}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
                      aria-label={`Select request from ${request.user?.name || "User"}`}
                    />
                  </div>
                )}

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
                  {request.status === "pending" && (
                    <Clock className="h-3 w-3" />
                  )}
                  {request.status === "approved" && (
                    <Check className="h-3 w-3" />
                  )}
                  {request.status === "rejected" && <X className="h-3 w-3" />}
                  {request.status === "cancelled" && <X className="h-3 w-3" />}
                  {STATUS_LABELS[request.status]}
                </span>

                {/* Actions */}
                {isPending && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(request)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1 cursor-pointer"
                      aria-label={`Approve request from ${request.user?.name || "User"}`}
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(request)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1 cursor-pointer"
                      aria-label={`Reject request from ${request.user?.name || "User"}`}
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Single Review Modal */}
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
              type="button"
              onClick={() => {
                setSelectedRequest(null);
                setReviewNotes("");
              }}
              className="absolute right-4 top-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close review modal"
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
                  type="button"
                  onClick={() => handleApprove(selectedRequest._id)}
                  disabled={actionLoading[selectedRequest._id]}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
                  type="button"
                  onClick={() => handleReject(selectedRequest._id)}
                  disabled={actionLoading[selectedRequest._id]}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

      {/* Bulk Action Confirmation Modal */}
      {bulkModalType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
          onClick={() => {
            if (!bulkLoading) {
              setBulkModalType(null);
              setBulkNotes("");
            }
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-xl animate-in zoom-in-95 slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-action-modal-title"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                if (!bulkLoading) {
                  setBulkModalType(null);
                  setBulkNotes("");
                }
              }}
              disabled={bulkLoading}
              className="absolute right-4 top-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Close bulk action modal"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>

            {/* Modal Content */}
            <div className="p-6">
              <h3
                id="bulk-action-modal-title"
                className="text-xl font-bold text-slate-900 dark:text-white mb-2"
              >
                {bulkModalType === "approve"
                  ? `Approve ${selectedIds.length} Membership Request${selectedIds.length === 1 ? "" : "s"}`
                  : `Reject ${selectedIds.length} Membership Request${selectedIds.length === 1 ? "" : "s"}`}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                {bulkModalType === "approve"
                  ? `Are you sure you want to approve ${selectedIds.length} selected request(s)? They will gain member access to this organization.`
                  : `Are you sure you want to reject ${selectedIds.length} selected request(s)? This action cannot be undone.`}
              </p>

              {/* Review Notes */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {bulkModalType === "approve"
                    ? "Approval Note (optional)"
                    : "Rejection Reason / Note (optional)"}
                </label>
                <textarea
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  placeholder={
                    bulkModalType === "approve"
                      ? "Welcome message or onboarding note..."
                      : "Provide a reason for rejection..."
                  }
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 dark:text-slate-100 resize-none"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {bulkNotes.length}/500 characters
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setBulkModalType(null);
                    setBulkNotes("");
                  }}
                  disabled={bulkLoading}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBulkAction}
                  disabled={bulkLoading}
                  className={`flex-1 px-4 py-2.5 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                    bulkModalType === "approve"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {bulkLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : bulkModalType === "approve" ? (
                    <>
                      <Check className="h-4 w-4" />
                      Confirm Approve
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" />
                      Confirm Reject
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

MembershipRequests.propTypes = {
  organizationId: PropTypes.string,
};

export default MembershipRequests;
