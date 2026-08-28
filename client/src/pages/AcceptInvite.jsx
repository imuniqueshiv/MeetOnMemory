import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import AppContent from "../context/AppContent.js";
import { invitationApi, organizationApi } from "../services";
import Navbar from "../components/Navbar.jsx";
import { toast } from "react-toastify";
import {
  Building2,
  CheckCircle,
  Loader2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Users,
  Eye,
  Shield,
  Sparkles,
  ArrowRight,
  UserCheck,
  Mail,
  Calendar,
  Layers,
  ExternalLink,
  RotateCcw,
  LogIn,
  Check,
} from "lucide-react";
import { validateRedirect } from "../utils/validateRedirect.js";

const ROLE_DETAILS = {
  admin: {
    label: "Administrator",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    badgeColor: "bg-purple-600 text-white",
    icon: ShieldCheck,
    description:
      "Full administrative and management privileges across the organization workspace.",
    capabilities: [
      "Invite and manage team members and member roles",
      "Create, schedule, and manage all organization meetings",
      "Configure organization settings and integration rules",
      "Access organizational audit logs and deep analytics",
    ],
  },
  member: {
    label: "Team Member",
    color:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    badgeColor: "bg-blue-600 text-white",
    icon: Users,
    description:
      "Standard collaborative access to create and participate across the workspace.",
    capabilities: [
      "Schedule and host meetings with AI transcription & summaries",
      "Generate and persist conference session cards",
      "Create and track action items, tasks, and follow-ups",
      "Collaborate on organization templates and knowledge graphs",
    ],
  },
  moderator: {
    label: "Moderator",
    color:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    badgeColor: "bg-indigo-600 text-white",
    icon: Shield,
    description:
      "Content moderation, review, and meeting management capabilities.",
    capabilities: [
      "Host and moderate meetings and room participants",
      "Review organization policies and compliance rules",
      "Manage action items, shared templates, and meeting agendas",
      "Collaborate across all organization team spaces",
    ],
  },
  viewer: {
    label: "Viewer",
    color:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    badgeColor: "bg-emerald-600 text-white",
    icon: Eye,
    description:
      "Read-only access to view organization meetings, transcripts, and insights.",
    capabilities: [
      "View upcoming and past organization meetings & agendas",
      "Read AI-generated meeting summaries and transcripts",
      "Explore organization knowledge base and decision logs",
      "View shared team reports and attendance analytics",
    ],
  },
};

const AcceptInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedin, getUserData, userData } = useContext(AppContent);

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const fetchInvite = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await invitationApi.getInvitationByToken(token);
      if (res.data?.success) {
        setInvitation(res.data.invitation || res.data.data?.invitation);
      } else {
        setError(res.data?.message || "Invalid or expired invitation.");
      }
    } catch (err) {
      console.error("Fetch invite error", err);
      setError(
        err.response?.data?.message || "Invalid or expired invitation token.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInvite();
  }, [fetchInvite]);

  const roleConfig = useMemo(() => {
    const roleKey = (invitation?.role || "member").toLowerCase();
    return ROLE_DETAILS[roleKey] || ROLE_DETAILS.member;
  }, [invitation?.role]);

  const isExpiredError = useMemo(() => {
    if (!error) return false;
    const lower = error.toLowerCase();
    return lower.includes("expired") || lower.includes("expiration");
  }, [error]);

  const isAlreadyMemberError = useMemo(() => {
    if (!error) return false;
    const lower = error.toLowerCase();
    return lower.includes("already a member") || lower.includes("accepted");
  }, [error]);

  const handleAccept = async () => {
    if (!isLoggedin) {
      toast.info(
        "Please log in or create an account to accept the invitation.",
      );
      navigate("/login", {
        state: {
          from: { pathname: `/invite/${token}` },
          redirect: `/invite/${token}`,
        },
      });
      return;
    }

    setAccepting(true);
    try {
      let res;
      try {
        res = await organizationApi.acceptInviteToken(token);
      } catch {
        res = await invitationApi.acceptInvitation(token);
      }

      if (res.data?.success || res.status === 200) {
        toast.success("✨ Successfully joined the organization!");
        await getUserData();
        setIsSuccess(true);
      } else {
        toast.error(res.data?.message || "Failed to accept invitation.");
      }
    } catch (err) {
      console.error("Accept invite error", err);
      toast.error(
        err.response?.data?.message || "Failed to accept invitation.",
      );
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!isLoggedin) {
      navigate("/");
      return;
    }

    setDeclining(true);
    try {
      const res = await invitationApi.rejectInvitation(token);
      if (res.data?.success) {
        toast.info("Invitation declined.");
        navigate("/dashboard");
      } else {
        toast.error(res.data?.message || "Failed to decline invitation.");
      }
    } catch (err) {
      console.error("Decline invite error", err);
      toast.error(
        err.response?.data?.message || "Failed to decline invitation.",
      );
    } finally {
      setDeclining(false);
    }
  };

  const handleFinishOnboarding = (targetPath = "/dashboard") => {
    const redirectPath =
      location.state?.redirect || location.state?.from?.pathname;
    const safePath = validateRedirect(redirectPath, targetPath);
    navigate(safePath);
  };

  const orgInitial = invitation?.organization?.name
    ? invitation.organization.name.charAt(0).toUpperCase()
    : "M";

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/50 via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-20 md:py-28">
        <div className="w-full max-w-xl">
          {/* Loading State */}
          {loading && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 shadow-xl text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-600 mb-2" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Validating your invitation...
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Please wait while we retrieve the organization details and
                verify your invitation token.
              </p>
            </div>
          )}

          {/* Success / Guided Next Steps Screen */}
          {!loading && isSuccess && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <Sparkles size={36} />
              </div>

              <div>
                <span className="inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full mb-3">
                  🎉 Invitation Accepted
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  Welcome to {invitation?.organization?.name || "the Team"}!
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto">
                  You are now an active{" "}
                  <strong className="capitalize">
                    {invitation?.role || "member"}
                  </strong>
                  . Your workspace is ready—explore the key hubs below to get
                  started.
                </p>
              </div>

              {/* Guided Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
                <button
                  type="button"
                  onClick={() => handleFinishOnboarding("/meetings")}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-blue-50/60 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition group cursor-pointer"
                >
                  <div className="p-2 w-fit rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 mb-2 group-hover:scale-105 transition">
                    <Calendar size={18} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>Explore Meetings</span>
                    <ArrowRight
                      size={14}
                      className="text-slate-400 group-hover:text-blue-600 transition"
                    />
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    View upcoming schedules, AI notes, and session recordings.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleFinishOnboarding("/team-members")}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-purple-50/60 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition group cursor-pointer"
                >
                  <div className="p-2 w-fit rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 mb-2 group-hover:scale-105 transition">
                    <Users size={18} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>Meet the Team</span>
                    <ArrowRight
                      size={14}
                      className="text-slate-400 group-hover:text-purple-600 transition"
                    />
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Connect with teammates and see active workspaces.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleFinishOnboarding("/session-cards")}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50/60 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 transition group cursor-pointer sm:col-span-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition">
                      <Layers size={18} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>Browse Org Session Cards & Knowledge</span>
                        <ArrowRight
                          size={14}
                          className="text-slate-400 group-hover:text-indigo-600 transition"
                        />
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Access shared conference session summaries and
                        organizational intelligence.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => handleFinishOnboarding("/dashboard")}
                  className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Launch Workspace Dashboard</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Error / Recovery States */}
          {!loading && !isSuccess && error && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-xl space-y-6 text-center">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${
                  isExpiredError
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                    : isAlreadyMemberError
                      ? "bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                      : "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400"
                }`}
              >
                {isExpiredError ? (
                  <Clock size={32} />
                ) : isAlreadyMemberError ? (
                  <UserCheck size={32} />
                ) : (
                  <AlertCircle size={32} />
                )}
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {isExpiredError
                    ? "Invitation Expired"
                    : isAlreadyMemberError
                      ? "Already a Member"
                      : "Invitation Error"}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto">
                  {isExpiredError
                    ? "This invitation link has expired for security reasons. Please reach out to your team administrator to request a new invitation."
                    : isAlreadyMemberError
                      ? "Your account is already a member of this organization workspace."
                      : error}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {isAlreadyMemberError ? (
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition"
                  >
                    Go to Organization Dashboard
                  </button>
                ) : isExpiredError ? (
                  <div className="space-y-2">
                    <a
                      href="mailto:?subject=New%20Invitation%20Request&body=Hi,%20my%20invitation%20link%20has%20expired.%20Could%20you%20please%20send%20me%20a%20new%20invite?"
                      className="w-full py-3 px-4 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 transition flex items-center justify-center gap-2"
                    >
                      <Mail size={16} />
                      <span>Request New Invite via Email</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => navigate("/browse-organizations")}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm transition"
                    >
                      Browse Public Organizations
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => fetchInvite()}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm transition flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={15} />
                      <span>Retry Verification</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/")}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm transition"
                    >
                      Return to Homepage
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Valid Invitation Experience */}
          {!loading && !isSuccess && !error && invitation && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6">
              {/* Organization Header & Branding */}
              <div className="text-center space-y-3">
                <div className="relative inline-block">
                  {invitation.organization?.logo ? (
                    <img
                      src={invitation.organization.logo}
                      alt={invitation.organization?.name || "Organization Logo"}
                      className="w-20 h-20 rounded-2xl object-cover mx-auto shadow-md border-2 border-white dark:border-slate-800"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-3xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
                      {orgInitial}
                    </div>
                  )}
                  <span className="absolute -bottom-2 -right-2 p-1.5 bg-blue-600 text-white rounded-xl shadow-xs">
                    <Building2 size={16} />
                  </span>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full mb-2">
                    <Sparkles size={12} />
                    <span>Workspace Invitation</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    {invitation.organization?.name || "Organization Workspace"}
                  </h1>
                  {invitation.organization?.slug && (
                    <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                      @{invitation.organization.slug}
                    </p>
                  )}
                  {invitation.organization?.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto line-clamp-2">
                      {invitation.organization.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Inviter Info Strip */}
              {invitation.invitedBy && (
                <div className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                    <Mail size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-700 dark:text-slate-300">
                      Invited by{" "}
                      <strong className="text-slate-900 dark:text-white">
                        {invitation.invitedBy.name || "Team Admin"}
                      </strong>
                      {invitation.invitedBy.email && (
                        <span className="text-slate-400 ml-1">
                          ({invitation.invitedBy.email})
                        </span>
                      )}
                    </p>
                    {invitation.message && (
                      <p className="italic text-slate-500 dark:text-slate-400 mt-1 border-t border-slate-200/60 dark:border-slate-700/60 pt-1">
                        "{invitation.message}"
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Role Capabilities Breakdown */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <roleConfig.icon
                      size={18}
                      className="text-blue-600 dark:text-blue-400"
                    />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Your Assigned Role
                    </h3>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${roleConfig.badgeColor}`}
                  >
                    {roleConfig.label}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {roleConfig.description}
                </p>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Role Capabilities:
                  </p>
                  <ul className="space-y-1.5">
                    {roleConfig.capabilities.map((cap, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300"
                      >
                        <Check
                          size={14}
                          className="text-emerald-500 shrink-0 mt-0.5"
                        />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Auth Context Badge */}
              <div className="text-center text-xs text-slate-500 dark:text-slate-400">
                {isLoggedin ? (
                  <p className="flex items-center justify-center gap-1.5">
                    <UserCheck size={14} className="text-emerald-500" />
                    <span>
                      Signed in as{" "}
                      <strong>{userData?.email || "Authenticated User"}</strong>
                    </span>
                  </p>
                ) : (
                  <p className="flex items-center justify-center gap-1.5">
                    <LogIn size={14} className="text-blue-500" />
                    <span>
                      You'll be prompted to sign in or create an account to
                      accept.
                    </span>
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={accepting || declining}
                  className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Joining Organization...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>
                        Accept & Join{" "}
                        {invitation.organization?.name || "Organization"}
                      </span>
                    </>
                  )}
                </button>

                {isLoggedin && (
                  <button
                    type="button"
                    onClick={handleDecline}
                    disabled={accepting || declining}
                    className="w-full py-2.5 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-medium transition cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {declining ? "Declining..." : "Decline Invitation"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AcceptInvite;
