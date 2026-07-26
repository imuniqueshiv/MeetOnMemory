import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import {
  Users,
  Search,
  Filter,
  Mail,
  Calendar,
  Shield,
  X,
  ChevronDown,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Send,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { useTeamManagement } from "../hooks/useTeamManagement";
import InviteMemberForm from "../components/team/InviteMemberForm";
import TeamMemberTable from "../components/team/TeamMemberTable";

const TeamMembers = () => {
  const [activeTab, setActiveTab] = useState("members"); // "members" | "invitations"

  const {
    members,
    invitations,
    loading,
    invitesLoading,
    error,
    isAdmin,
    fetchMembers,
    handleSendInvite,
    handleResendInvite,
    handleCancelInvite,
    handleExpireInvite,
  } = useTeamManagement(activeTab);

  const [filteredMembers, setFilteredMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy] = useState("name");
  const [sortOrder] = useState("asc");
  const [roleFilter, setRoleFilter] = useState("all");

  const [showInviteModal, setShowInviteModal] = useState(false);

  const applyFiltersAndSort = useCallback(() => {
    let result = [...members];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (member) =>
          member.name?.toLowerCase().includes(query) ||
          member.email?.toLowerCase().includes(query) ||
          member.role?.toLowerCase().includes(query),
      );
    }

    if (roleFilter !== "all") {
      result = result.filter((member) => member.role === roleFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "role":
          comparison = (a.role || "").localeCompare(b.role || "");
          break;
        case "joined":
          comparison = new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    setFilteredMembers(result);
  }, [members, searchQuery, roleFilter, sortBy, sortOrder]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Navbar />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Navbar />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <XCircle className="h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Error Loading Members
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
            <button
              onClick={fetchMembers}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-600/20">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                Team Members
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold">
                {activeTab === "members"
                  ? `${filteredMembers.length} ${filteredMembers.length === 1 ? "member" : "members"}`
                  : `${invitations.length} ${invitations.length === 1 ? "invitation" : "invitations"}`}
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Invite Member
            </button>
          )}
        </div>

        {/* Tabs */}
        {isAdmin && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
            <button
              onClick={() => setActiveTab("members")}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "members"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              Members
            </button>
            <button
              onClick={() => setActiveTab("invitations")}
              className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "invitations"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              Invitations
            </button>
          </div>
        )}

        {activeTab === "members" ? (
          <>
            {/* Search and Filters */}
            <div className="mb-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                  />
                </button>

                {showFilters && (
                  <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Roles</option>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <TeamMemberTable
              members={filteredMembers}
              searchQuery={searchQuery}
              roleFilter={roleFilter}
            />
          </>
        ) : (
          <>
            {/* Invitations List */}
            {invitesLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600"></div>
              </div>
            ) : invitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Mail className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  No invitations sent
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm">
                  Invite members by email to onboard them into your
                  organization.
                </p>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer font-semibold shadow-md shadow-blue-600/10 active:scale-95"
                >
                  Send Invitation
                </button>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in duration-200">
                {invitations.map((invite) => (
                  <div
                    key={invite._id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-xs transition-shadow"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {invite.email}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            invite.role === "admin"
                              ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800"
                              : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800"
                          }`}
                        >
                          {invite.role}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          Invited by {invite.invitedBy?.name || "Admin"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Expires {formatDate(invite.expiresAt)}
                        </span>
                      </div>
                      {invite.message && (
                        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 italic truncate max-w-xl">
                          "{invite.message}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 justify-between md:justify-end">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          invite.status === "pending"
                            ? "bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800"
                            : invite.status === "accepted"
                              ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                              : invite.status === "declined"
                                ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                                : invite.status === "expired"
                                  ? "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
                                  : "bg-slate-50 text-slate-500 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                        }`}
                      >
                        {invite.status === "pending" && (
                          <Clock className="w-3 h-3" />
                        )}
                        {invite.status === "accepted" && (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        {invite.status === "declined" && (
                          <XCircle className="w-3 h-3" />
                        )}
                        {invite.status === "expired" && (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {invite.status === "cancelled" && (
                          <Ban className="w-3 h-3" />
                        )}
                        <span className="capitalize">{invite.status}</span>
                      </span>

                      {invite.status === "pending" && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleResendInvite(invite._id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                            title="Resend invitation"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleExpireInvite(invite._id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
                            title="Expire invitation"
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleCancelInvite(invite._id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600 hover:text-red-700 transition-colors cursor-pointer"
                            title="Cancel invitation"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {showInviteModal && (
        <InviteMemberForm
          onClose={() => setShowInviteModal(false)}
          onSendInvite={handleSendInvite}
        />
      )}
    </div>
  );
};

export default TeamMembers;
