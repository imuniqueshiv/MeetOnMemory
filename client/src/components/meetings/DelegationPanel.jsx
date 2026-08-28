import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Search, Send, User, Shield, Briefcase, Eye } from "lucide-react";
import api from "../../services/apiClient.js";
import ConfirmModal from "../ConfirmModal.jsx";

const SCOPES = [
  {
    id: "full",
    label: "Full Delegation",
    icon: Shield,
    description: "Delegate attendance, voting, and action items.",
  },
  {
    id: "action_items",
    label: "Action Items",
    icon: Briefcase,
    description: "Temporarily assign unresolved action items.",
  },
  {
    id: "voting",
    label: "Voting Rights",
    icon: Shield,
    description: "Transfer voting rights for agenda items.",
  },
  {
    id: "observation",
    label: "Observation Only",
    icon: Eye,
    description: "Attend and observe on your behalf.",
  },
];

const DelegationPanel = ({ meetingId, participants }) => {
  const [delegation, setDelegation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [delegateeId, setDelegateeId] = useState("");
  const [selectedScopes, setSelectedScopes] = useState(["full"]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);

  useEffect(() => {
    fetchDelegation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const fetchDelegation = async () => {
    try {
      const response = await api.get(`/api/delegations/meeting/${meetingId}`);
      if (response?.data?.delegation) {
        setDelegation(response.data.delegation);
      }
    } catch (err) {
      console.error("Failed to fetch delegation", err);
    } finally {
      setLoading(false);
    }
  };

  const handleScopeToggle = (scopeId) => {
    if (scopeId === "full") {
      setSelectedScopes(["full"]);
    } else {
      let newScopes = selectedScopes.filter((s) => s !== "full");
      if (newScopes.includes(scopeId)) {
        newScopes = newScopes.filter((s) => s !== scopeId);
      } else {
        newScopes.push(scopeId);
      }
      setSelectedScopes(newScopes);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!delegateeId) {
      return toast.error("Please select a teammate to delegate to.");
    }
    if (selectedScopes.length === 0) {
      return toast.error("Please select at least one delegation scope.");
    }

    setIsSubmitting(true);
    try {
      const response = await api.post("/api/delegations", {
        meetingId,
        delegateeId,
        scope: selectedScopes,
      });
      setDelegation(response.data.delegation);
      toast.success("Delegation request sent successfully!");
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to create delegation request",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmRevoke = async () => {
    if (!delegation?._id) return;
    setIsSubmitting(true);
    try {
      const response = await api.post(
        `/api/delegations/${delegation._id}/revoke`,
      );
      setDelegation(response.data.delegation);
      toast.success("Delegation revoked.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to revoke delegation");
    } finally {
      setIsSubmitting(false);
      setShowRevokeModal(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 animate-pulse h-32"></div>
    );
  }

  if (delegation) {
    return (
      <>
        <div className="p-4 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Active Delegation
              </h3>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Status:{" "}
                <span className="font-medium capitalize">
                  {delegation.status}
                </span>
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                Delegatee: {delegation.delegateeId?.name || "Unknown"}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {delegation.scope.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full dark:bg-blue-800 dark:text-blue-200 capitalize"
                  >
                    {s.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
            {delegation.status === "pending" ||
            delegation.status === "approved" ? (
              <button
                type="button"
                onClick={() => setShowRevokeModal(true)}
                disabled={isSubmitting}
                className="text-sm text-red-600 hover:text-red-700 font-medium cursor-pointer disabled:opacity-50"
              >
                Revoke
              </button>
            ) : null}
          </div>
        </div>

        <ConfirmModal
          isOpen={showRevokeModal}
          onClose={() => setShowRevokeModal(false)}
          onConfirm={confirmRevoke}
          title="Revoke Delegation"
          message="Are you sure you want to revoke this delegation request?"
          confirmText="Revoke"
          cancelText="Cancel"
          isLoading={isSubmitting}
          loadingText="Revoking..."
          variant="danger"
        />
      </>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 mb-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <User className="w-5 h-5 text-gray-500" />
        Delegate Attendance
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Cannot make it? Delegate your attendance to a teammate to handle your
        action items and voting rights.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select Teammate
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <select
              value={delegateeId}
              onChange={(e) => setDelegateeId(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="" disabled>
                Select a participant...
              </option>
              {participants?.map((p) => (
                <option
                  key={p.user?._id || p.user}
                  value={p.user?._id || p.user}
                >
                  {p.name} {p.email ? `(${p.email})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Delegation Scope
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SCOPES.map((scope) => {
              const isSelected = selectedScopes.includes(scope.id);
              const Icon = scope.icon;
              return (
                <div
                  key={scope.id}
                  onClick={() => handleScopeToggle(scope.id)}
                  className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700"
                      : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <div
                    className={`mt-0.5 mr-3 ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4
                      className={`text-sm font-medium ${isSelected ? "text-blue-900 dark:text-blue-300" : "text-gray-900 dark:text-gray-100"}`}
                    >
                      {scope.label}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {scope.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? "Sending..." : "Request Delegation"}
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default DelegationPanel;
