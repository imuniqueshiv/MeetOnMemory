import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Users,
  Clock,
  Check,
  X,
  Loader2,
  FileText,
  Calendar,
  Building2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import { membershipRequestApi } from "../services";

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

const MembershipRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [requests, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data } = await membershipRequestApi.getUserRequests();
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

  const handleCancel = async (requestId) => {
    try {
      setActionLoading((prev) => ({ ...prev, [requestId]: true }));
      const { data } = await membershipRequestApi.cancelRequest(requestId);
      if (data.success) {
        toast.success("Request cancelled successfully");
        await fetchRequests();
      } else {
        toast.error(data.message || "Failed to cancel request");
      }
    } catch (err) {
      console.error("Error cancelling request:", err);
      toast.error(err.response?.data?.message || "Failed to cancel request");
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const handleViewOrganization = (organizationSlug) => {
    navigate(`/organizations/${organizationSlug}`);
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

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Navbar />

      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-600/20">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                My Membership Requests
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {filteredRequests.length}{" "}
                {filteredRequests.length === 1 ? "request" : "requests"}
              </p>
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <div className="mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Requests</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
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
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              {statusFilter === "all"
                ? "You haven't submitted any membership requests yet"
                : `No ${STATUS_LABELS[statusFilter].toLowerCase()} requests found`}
            </p>
            {statusFilter === "all" && (
              <button
                onClick={() => navigate("/browse-organizations")}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse Organizations
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request) => (
              <div
                key={request._id}
                className="group relative flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all"
              >
                {/* Organization Logo */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white font-bold text-lg">
                  {request.organization?.logo ? (
                    <img
                      src={request.organization.logo}
                      alt={request.organization.name}
                      className="w-full h-full rounded-xl object-cover"
                    />
                  ) : (
                    request.organization?.name?.charAt(0)?.toUpperCase() || "O"
                  )}
                </div>

                {/* Request Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                      {request.organization?.name || "Unknown Organization"}
                    </h3>
                    <button
                      onClick={() =>
                        handleViewOrganization(request.organization?.slug)
                      }
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                      title="View organization"
                    >
                      <ExternalLink className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>

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

                  {request.reviewNotes && (
                    <div className="mt-2 p-2 rounded bg-slate-50 dark:bg-slate-800">
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-medium">Admin note:</span>{" "}
                        {request.reviewNotes}
                      </p>
                    </div>
                  )}
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
                {request.status === "pending" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCancel(request._id)}
                      disabled={actionLoading[request._id]}
                      className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                    >
                      {actionLoading[request._id] ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" />
                          Cancel
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MembershipRequests;
