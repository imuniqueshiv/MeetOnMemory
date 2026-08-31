// components/organization/DangerZone.jsx
import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { organizationApi } from "../../services/organizationApi";
import {
  AlertTriangle,
  UserMinus,
  UserPlus,
  Trash2,
  Shield,
  ShieldAlert,
  ShieldOff,
  Users,
  Crown,
  UserX,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  User,
  Clock,
  Key,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  AlertOctagon,
  Ban,
  Flag,
  Heart,
  HeartOff,
  Star,
  StarOff,
  Award,
  Medal,
  Trophy,
  Crown as CrownIcon,
  Settings,
  X,
  Database,
} from "lucide-react";

// Confirmation Modal with Typed Confirmation
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  confirmKeyword,
  actionType = "danger",
  isLoading = false,
  children,
}) => {
  const [typedText, setTypedText] = useState("");
  const inputRef = React.useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTypedText("");
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (typedText.trim() === confirmKeyword) {
      onConfirm();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && typedText.trim() === confirmKeyword) {
      handleConfirm();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  const isConfirmEnabled = typedText.trim() === confirmKeyword && !isLoading;

  const getActionStyles = () => {
    switch (actionType) {
      case "danger":
        return {
          border: "border-red-500/50 dark:border-red-500/30",
          bg: "bg-red-50 dark:bg-red-950/30",
          icon: "text-red-600 dark:text-red-400",
          button: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
          text: "text-red-600 dark:text-red-400",
        };
      case "warning":
        return {
          border: "border-yellow-500/50 dark:border-yellow-500/30",
          bg: "bg-yellow-50 dark:bg-yellow-950/30",
          icon: "text-yellow-600 dark:text-yellow-400",
          button: "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500",
          text: "text-yellow-600 dark:text-yellow-400",
        };
      case "info":
        return {
          border: "border-blue-500/50 dark:border-blue-500/30",
          bg: "bg-blue-50 dark:bg-blue-950/30",
          icon: "text-blue-600 dark:text-blue-400",
          button: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
          text: "text-blue-600 dark:text-blue-400",
        };
      default:
        return {
          border: "border-slate-500/50 dark:border-slate-500/30",
          bg: "bg-slate-50 dark:bg-slate-950/30",
          icon: "text-slate-600 dark:text-slate-400",
          button: "bg-slate-600 hover:bg-slate-700 focus:ring-slate-500",
          text: "text-slate-600 dark:text-slate-400",
        };
    }
  };

  const styles = getActionStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border ${styles.border} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center gap-3 p-6 border-b ${styles.border}`}
        >
          <div className={`p-2 rounded-xl ${styles.bg}`}>
            {actionType === "danger" ? (
              <AlertOctagon className={`w-6 h-6 ${styles.icon}`} />
            ) : actionType === "warning" ? (
              <AlertTriangle className={`w-6 h-6 ${styles.icon}`} />
            ) : (
              <AlertCircle className={`w-6 h-6 ${styles.icon}`} />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
            {message && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {message}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {children}

          {/* Confirmation Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Type{" "}
              <span className="font-mono font-bold text-red-600 dark:text-red-400">
                {confirmKeyword}
              </span>{" "}
              to confirm
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Type "${confirmKeyword}" here...`}
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 text-slate-900 dark:text-white transition-all"
                disabled={isLoading}
                autoComplete="off"
              />
              {typedText.trim() === confirmKeyword && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              This confirms you understand the consequences
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isLoading}
            className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all ${
              isConfirmEnabled && !isLoading
                ? `${styles.button} shadow-lg shadow-red-500/20`
                : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                Processing...
              </>
            ) : (
              confirmText || "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Transfer Ownership Modal
const TransferOwnershipModal = ({
  isOpen,
  onClose,
  onTransfer,
  members,
  currentOwnerId,
  isLoading = false,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [typedText, setTypedText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelectedMemberId("");
      setTypedText("");
      setError("");
    }
  }, [isOpen]);

  const handleTransfer = () => {
    if (!selectedMemberId) {
      setError("Please select a member to transfer ownership to");
      return;
    }
    if (selectedMemberId === currentOwnerId) {
      setError("Cannot transfer ownership to yourself");
      return;
    }
    if (typedText.trim() !== "transfer") {
      setError('Please type "transfer" to confirm');
      return;
    }
    onTransfer(selectedMemberId);
  };

  const selectedMember = members.find((m) => m._id === selectedMemberId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-blue-500/30 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-blue-500/30">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
            <CrownIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Transfer Organization Ownership
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Transfer ownership to another member of the organization
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning Banner */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Important: Ownership Transfer
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Transferring ownership will give the new owner full control
                  over the organization. You will lose administrative privileges
                  and cannot undo this action.
                </p>
              </div>
            </div>
          </div>

          {/* Member Select */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Select New Owner <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => {
                setSelectedMemberId(e.target.value);
                setError("");
              }}
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all"
            >
              <option value="">Select a member...</option>
              {members
                .filter((m) => m._id !== currentOwnerId)
                .map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.name || member.email}{" "}
                    {member.role === "admin" && "(Admin)"}
                  </option>
                ))}
            </select>
            {selectedMember && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {selectedMember.name || "Unnamed Member"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedMember.email} • Role:{" "}
                      {selectedMember.role || "member"}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </p>
            )}
          </div>

          {/* Confirmation Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Type{" "}
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                transfer
              </span>{" "}
              to confirm
            </label>
            <input
              type="text"
              value={typedText}
              onChange={(e) => {
                setTypedText(e.target.value);
                setError("");
              }}
              placeholder='Type "transfer" here...'
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all"
              disabled={isLoading}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={
              !selectedMemberId || typedText.trim() !== "transfer" || isLoading
            }
            className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all ${
              selectedMemberId && typedText.trim() === "transfer" && !isLoading
                ? "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                Transferring...
              </>
            ) : (
              "Transfer Ownership"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Danger Zone Component
const DangerZone = ({
  organization,
  members,
  currentUser,
  userRole,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [organizationName, setOrganizationName] = useState("");

  const isOwner = userRole === "owner";

  const recordAuditEvent = useCallback(
    async (actionType, summaryText) => {
      if (!organization?._id) return false;
      const currentUserId =
        currentUser?.id || currentUser?._id || "unknown_user";
      try {
        const response = await fetch(
          `/api/organizations/${organization._id}/audit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: actionType,
              userId: currentUserId,
              details: summaryText,
            }),
          },
        );

        if (!response.ok) throw new Error("Audit trail storage failed.");
        return true;
      } catch (error) {
        console.error("[CRITICAL] Audit logging broken:", error);
        toast.error(
          "Security boundary error: Action blocked because audit trail could not be saved.",
        );
        return false;
      }
    },
    [organization?._id, currentUser],
  );

  // Leave Organization
  const handleLeave = useCallback(async () => {
    if (!organization?._id) return;

    setLoading(true);
    try {
      const logged = await recordAuditEvent(
        "ORG_LEAVE",
        "User left organization",
      );
      if (!logged) {
        setLoading(false);
        setShowLeaveConfirm(false);
        return;
      }

      const response = await organizationApi.leaveOrganization(
        organization._id,
      );

      if (response.data.success) {
        toast.success("You have left the organization successfully");

        // Redirect to dashboard
        setTimeout(() => {
          navigate("/dashboard");
        }, 500);
      } else {
        throw new Error(
          response.data.message || "Failed to leave organization",
        );
      }
    } catch (error) {
      console.error("Error leaving organization:", error);
      toast.error(
        error.message || "Failed to leave organization. Please try again.",
      );
    } finally {
      setLoading(false);
      setShowLeaveConfirm(false);
    }
  }, [organization, navigate, recordAuditEvent]);

  // Delete Organization
  const handleDelete = useCallback(async () => {
    if (!organization?._id) return;
    if (organizationName !== organization.name) {
      toast.error("Organization name does not match");
      return;
    }

    setLoading(true);
    try {
      const logged = await recordAuditEvent(
        "ORG_DELETION",
        "User initiated permanent organization deletion",
      );
      if (!logged) {
        setLoading(false);
        setShowDeleteConfirm(false);
        return;
      }

      const response = await organizationApi.deleteOrganization(
        organization._id,
      );

      if (response.data.success) {
        toast.success("Organization has been permanently deleted");

        // Redirect to dashboard
        setTimeout(() => {
          navigate("/dashboard");
        }, 500);
      } else {
        throw new Error(
          response.data.message || "Failed to delete organization",
        );
      }
    } catch (error) {
      console.error("Error deleting organization:", error);
      toast.error(
        error.message || "Failed to delete organization. Please try again.",
      );
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
      setOrganizationName("");
    }
  }, [organization, navigate, organizationName, recordAuditEvent]);

  // Transfer Ownership
  const handleTransfer = useCallback(
    async (newOwnerId) => {
      if (!organization?._id || !newOwnerId) return;

      setLoading(true);
      try {
        const logged = await recordAuditEvent(
          "ORG_OWNERSHIP_TRANSFER",
          `Transferred ownership to ${newOwnerId}`,
        );
        if (!logged) {
          setLoading(false);
          setShowTransferModal(false);
          return;
        }

        const response = await organizationApi.transferOwnership(
          organization._id,
          {
            newOwnerId,
          },
        );

        if (response.data.success) {
          toast.success(
            `Ownership transferred to ${response.data.newOwner?.name || "new owner"}`,
          );

          // Refresh organization data
          if (onRefresh) {
            await onRefresh();
          }
        } else {
          throw new Error(
            response.data.message || "Failed to transfer ownership",
          );
        }
      } catch (error) {
        console.error("Error transferring ownership:", error);
        toast.error(
          error.message || "Failed to transfer ownership. Please try again.",
        );
      } finally {
        setLoading(false);
        setShowTransferModal(false);
      }
    },
    [organization, onRefresh, recordAuditEvent],
  );

  // Get eligible members for transfer
  const transferMembers =
    members?.filter(
      (m) =>
        m._id !== currentUser?.id && (m.role === "admin" || m.role === "owner"),
    ) || [];

  // Render Danger Zone
  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-red-200/80 dark:border-red-800/60 rounded-2xl shadow-sm overflow-hidden">
      {/* Header - Always visible */}
      <div
        className="flex items-center justify-between p-6 cursor-pointer hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-xl text-red-600 dark:text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              ⚠️ Danger Zone
              {!expanded && (
                <span className="text-xs font-normal text-red-500/70 dark:text-red-400/70">
                  (Click to expand)
                </span>
              )}
            </h2>
            <p className="text-xs text-red-500/80 dark:text-red-400/80">
              Irreversible actions for your organization
            </p>
          </div>
        </div>
        <button className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors">
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-red-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-red-500" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-red-200/50 dark:border-red-800/30 p-6 space-y-6">
          {/* Warning Banner */}
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  This section contains destructive actions
                </p>
                <p className="text-xs text-red-700 dark:text-red-400">
                  These actions cannot be undone. Please proceed with extreme
                  caution. All actions are logged for security and compliance
                  purposes.
                </p>
              </div>
            </div>
          </div>

          {/* Action: Leave Organization */}
          {!isOwner && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg text-yellow-600 dark:text-yellow-400">
                    <UserMinus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Leave Organization
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      You will lose access to all organization data and
                      resources. You can rejoin if invited again.
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Clock className="w-3 h-3" />
                        Immediate
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <AlertCircle className="w-3 h-3" />
                        Irreversible
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Users className="w-3 h-3" />
                        Access lost
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowLeaveConfirm(true);
                  }}
                  disabled={loading}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-yellow-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  <UserMinus className="w-4 h-4" />
                  Leave Organization
                </button>
              </div>
            </div>
          )}

          {/* Action: Transfer Ownership */}
          {isOwner && transferMembers.length > 0 && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
                    <CrownIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Transfer Ownership
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Transfer full control to another member. You will become a
                      regular member. You can only transfer to another admin or
                      owner.
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Shield className="w-3 h-3" />
                        Requires confirmation
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Users className="w-3 h-3" />
                        {transferMembers.length} eligible
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowTransferModal(true);
                  }}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Transfer Ownership
                </button>
              </div>
            </div>
          )}

          {/* No eligible members for transfer */}
          {isOwner && transferMembers.length === 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    No Eligible Members for Transfer
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    You need at least one admin or owner to transfer ownership.
                    Please promote a member to admin first.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action: Delete Organization */}
          {isOwner && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border-2 border-red-200 dark:border-red-800">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-200 dark:bg-red-900/60 rounded-lg text-red-700 dark:text-red-300">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-300">
                      Delete Organization
                    </h4>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80">
                      Permanently delete this organization and all associated
                      data. This action cannot be undone and will remove all
                      members.
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                        <AlertOctagon className="w-3 h-3" />
                        Irreversible
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                        <Users className="w-3 h-3" />
                        All members removed
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                        <Database className="w-3 h-3" />
                        All data deleted
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                        <Clock className="w-3 h-3" />
                        Immediate
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setOrganizationName("");
                  }}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-red-500/30 disabled:opacity-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Organization
                </button>
              </div>
            </div>
          )}

          {/* Audit Log Note */}
          <div className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Shield className="w-3.5 h-3.5" />
              <span>
                All destructive actions are logged for security compliance.
                Audit logs include user, action, timestamp, and organization.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modals */}
      <ConfirmModal
        isOpen={showLeaveConfirm}
        onClose={() => {
          setShowLeaveConfirm(false);
        }}
        onConfirm={handleLeave}
        title="Leave Organization"
        message={`You are about to leave "${organization?.name || "this organization"}". You will lose access to all data and resources.`}
        confirmText="Leave Organization"
        confirmKeyword="leave"
        actionType="warning"
        isLoading={loading}
      >
        <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                What happens when you leave?
              </p>
              <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1 mt-1">
                <li>• You will be removed from all organization channels</li>
                <li>• You will lose access to organization data</li>
                <li>• Your contributions will remain (as archived)</li>
                <li>• You can rejoin if invited again</li>
              </ul>
            </div>
          </div>
        </div>
      </ConfirmModal>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setOrganizationName("");
        }}
        onConfirm={handleDelete}
        title="Delete Organization"
        message={`You are about to permanently delete "${organization?.name || "this organization"}". This action cannot be undone.`}
        confirmText="Delete Organization"
        confirmKeyword="delete"
        actionType="danger"
        isLoading={loading}
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-700 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800 dark:text-red-300">
                  ⚠️ This action is irreversible!
                </p>
                <ul className="text-xs text-red-700 dark:text-red-400 space-y-1 mt-2">
                  <li>• All organization data will be permanently deleted</li>
                  <li>• All members will be removed</li>
                  <li>• All projects, tasks, and files will be lost</li>
                  <li>• This action cannot be undone</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Type the organization name to confirm:
            </label>
            <input
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder={`Type "${organization?.name}" here...`}
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-red-300 dark:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white font-mono transition-all"
              disabled={loading}
              autoComplete="off"
            />
            {organizationName && organizationName !== organization?.name && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Organization name does not match
              </p>
            )}
            {organizationName === organization?.name && (
              <p className="text-xs text-green-500 mt-1.5 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Organization name matches. You can proceed.
              </p>
            )}
          </div>
        </div>
      </ConfirmModal>

      {/* Transfer Ownership Modal */}
      <TransferOwnershipModal
        isOpen={showTransferModal}
        onClose={() => {
          setShowTransferModal(false);
        }}
        onTransfer={handleTransfer}
        members={members || []}
        currentOwnerId={currentUser?.id}
        isLoading={loading}
      />
    </div>
  );
};

export default DangerZone;
