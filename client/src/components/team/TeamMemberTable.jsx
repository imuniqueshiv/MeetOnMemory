import React, { useState } from "react";
import {
  Users,
  Calendar,
  Shield,
  Copy,
  CheckCircle,
  XCircle,
  X,
  Mail,
  Clock,
} from "lucide-react";
import { toast } from "react-toastify";

const ROLE_STYLES = {
  admin:
    "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800",
  member:
    "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800",
};

const ROLE_LABELS = {
  admin: "Admin",
  member: "Member",
};

const TeamMemberTable = ({ members, searchQuery, roleFilter }) => {
  const [selectedMember, setSelectedMember] = useState(null);

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    toast.success("Email copied to clipboard");
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
    });
  };

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          No members found
        </h3>
        <p className="text-slate-500 dark:text-slate-400">
          {searchQuery || roleFilter !== "all"
            ? "Try adjusting your search or filters"
            : "Your organization has no members yet"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {members.map((member) => (
          <div
            key={member._id}
            onClick={() => setSelectedMember(member)}
            className="group relative flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all cursor-pointer"
          >
            {/* Avatar */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold text-lg">
              {getInitials(member.name)}
            </div>

            {/* Member Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                  {member.name || "Unknown"}
                </h3>
                {member.isAccountVerified && (
                  <CheckCircle
                    className="h-4 w-4 text-green-500 shrink-0"
                    title="Verified"
                  />
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {member.email}
              </p>
            </div>

            {/* Role Badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${ROLE_STYLES[member.role?.toLowerCase()] || ROLE_STYLES.member}`}
            >
              <Shield className="h-3 w-3" />
              {ROLE_LABELS[member.role?.toLowerCase()] ||
                member.role ||
                "Member"}
            </span>

            {/* Join Date */}
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(member.createdAt)}</span>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyEmail(member.email);
                }}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Copy email"
              >
                <Copy className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Member Details Modal */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-xl animate-in zoom-in-95 slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute right-4 top-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            </button>

            {/* Modal Content */}
            <div className="p-6">
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-2xl mb-4">
                  {getInitials(selectedMember.name)}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedMember.name || "Unknown"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedMember.email}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Role
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${ROLE_STYLES[selectedMember.role?.toLowerCase()] || ROLE_STYLES.member}`}
                  >
                    {ROLE_LABELS[selectedMember.role?.toLowerCase()] ||
                      selectedMember.role ||
                      "Member"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Email
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyEmail(selectedMember.email)}
                    className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <span className="truncate max-w-[150px]">
                      {selectedMember.email}
                    </span>
                    <Copy className="h-4 w-4 shrink-0" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Joined
                    </span>
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {formatDate(selectedMember.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Status
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                    {selectedMember.isAccountVerified ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Verified
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-amber-500" />
                        Pending
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TeamMemberTable;
