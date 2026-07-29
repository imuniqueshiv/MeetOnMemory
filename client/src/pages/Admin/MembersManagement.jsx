import React, { useState, useEffect, useContext, useCallback } from "react";
import Navbar from "../../components/Navbar.jsx";
import AppContent from "../../context/AppContent.js";
import { organizationApi, invitationApi } from "../../services";
import { toast } from "react-toastify";
import RoleGate from "../../components/RoleGate.jsx";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  Send,
  X,
  Loader2,
  RefreshCw,
  Clock,
} from "lucide-react";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const MembersManagement = () => {
  const { userData } = useContext(AppContent);
  const orgId = userData?.organization?._id || userData?.organization;

  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [removeModalUser, setRemoveModalUser] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(null);

  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "member",
    message: "",
  });

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [membersRes, invitesRes] = await Promise.allSettled([
        organizationApi.getMembers(),
        invitationApi.getOrganizationInvitations(orgId, "pending"),
      ]);

      if (membersRes.status === "fulfilled" && membersRes.value.data?.success) {
        setMembers(membersRes.value.data.members || []);
      }

      if (invitesRes.status === "fulfilled" && invitesRes.value.data?.success) {
        setInvitations(invitesRes.value.data.invitations || []);
      }
    } catch (err) {
      console.error("Failed to load members or invitations", err);
      toast.error("Failed to load organization data.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setInviteModalOpen(false);
        setRemoveModalUser(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.email.trim()) return;

    setInviting(true);
    try {
      const res = await organizationApi.inviteMember(orgId, inviteForm);
      if (res.data?.success) {
        toast.success("Invitation sent successfully!");
        setInviteForm({ email: "", role: "member", message: "" });
        setInviteModalOpen(false);
        loadData();
      } else {
        toast.error(res.data?.message || "Failed to send invitation.");
      }
    } catch (err) {
      console.error("Invite error", err);
      toast.error(err.response?.data?.message || "Failed to send invitation.");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    setUpdatingUser(targetUserId);
    try {
      const res = await organizationApi.updateMemberRole(
        orgId,
        targetUserId,
        newRole,
      );
      if (res.data?.success) {
        toast.success(`Role updated to ${newRole}`);
        setMembers((prev) =>
          prev.map((m) => {
            const id = m.user?._id || m._id;
            if (id === targetUserId) {
              return { ...m, role: newRole };
            }
            return m;
          }),
        );
      } else {
        toast.error(res.data?.message || "Failed to update role.");
      }
    } catch (err) {
      console.error("Role update error", err);
      toast.error(err.response?.data?.message || "Failed to update role.");
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeModalUser) return;
    const targetUserId = removeModalUser.user?._id || removeModalUser._id;

    try {
      const res = await organizationApi.removeMember(orgId, targetUserId);
      if (res.data?.success) {
        toast.success("Member removed successfully.");
        setMembers((prev) =>
          prev.filter((m) => (m.user?._id || m._id) !== targetUserId),
        );
        setRemoveModalUser(null);
      } else {
        toast.error(res.data?.message || "Failed to remove member.");
      }
    } catch (err) {
      console.error("Remove member error", err);
      toast.error(err.response?.data?.message || "Failed to remove member.");
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    try {
      const res = await invitationApi.revokeInvitation(inviteId);
      if (res.data?.success) {
        toast.info("Invitation revoked.");
        setInvitations((prev) => prev.filter((i) => i._id !== inviteId));
      }
    } catch (err) {
      console.error("Revoke error", err);
      toast.error("Failed to revoke invitation.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pt-20">
      <Navbar />

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Organization Members & Roles
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage members, assign 4-tier roles (Owner, Admin, Member,
              Viewer), and send email invitations.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            <RoleGate resource="team_members" action="invite">
              <button
                onClick={() => setInviteModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                <UserPlus className="w-4 h-4" />
                Invite Member
              </button>
            </RoleGate>
          </div>
        </div>

        {/* Pending Invitations list */}
        {invitations.length > 0 && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Pending Invitations ({invitations.length})
            </h3>
            <div className="divide-y divide-amber-200/60 dark:divide-amber-900/40">
              {invitations.map((inv) => (
                <div
                  key={inv._id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {inv.email}
                    </span>
                    <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-medium">
                      {inv.role}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRevokeInvite(inv._id)}
                    className="text-red-600 dark:text-red-400 hover:underline text-xs"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members Table */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading members...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Member</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Joined</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {members.map((m) => {
                    const userObj = m.user || m;
                    const uId = userObj._id || m._id;
                    const isSelf =
                      (userData?._id || userData?.id) === uId.toString();

                    return (
                      <tr
                        key={uId}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="p-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center font-semibold text-xs">
                            {userObj.name?.[0]?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {userObj.name || "User"}
                              {isSelf && (
                                <span className="ml-2 text-[11px] text-slate-400">
                                  (You)
                                </span>
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-400">
                          {userObj.email}
                        </td>
                        <td className="p-4">
                          <RoleGate
                            resource="team_members"
                            action="change_role"
                            fallback={
                              <span className="capitalize px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {m.role || "member"}
                              </span>
                            }
                          >
                            <select
                              value={m.role || "member"}
                              disabled={updatingUser === uId || isSelf}
                              onChange={(e) =>
                                handleRoleChange(uId, e.target.value)
                              }
                              className="text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 focus:ring-2 focus:ring-blue-500"
                            >
                              {ROLE_OPTIONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          </RoleGate>
                        </td>
                        <td className="p-4 text-xs text-slate-500 dark:text-slate-400">
                          {m.joinedAt
                            ? new Date(m.joinedAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="p-4 text-right">
                          {!isSelf && (
                            <RoleGate resource="team_members" action="remove">
                              <button
                                onClick={() => setRemoveModalUser(m)}
                                className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                title="Remove member"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </RoleGate>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                Invite Member by Email
              </h3>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, email: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Role
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, role: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">Admin (Full Access)</option>
                  <option value="member">Member (Standard Access)</option>
                  <option value="viewer">Viewer (Read-Only Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Personal Message (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Welcome to our team space!"
                  value={inviteForm.message}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, message: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {inviting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removeModalUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-600" />
              Remove Member
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to remove{" "}
              <strong>
                {(removeModalUser.user || removeModalUser).name || "this user"}
              </strong>{" "}
              from the organization? They will lose access immediately.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRemoveModalUser(null)}
                className="px-4 py-2 rounded-lg border text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersManagement;
