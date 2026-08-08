import React, { useState, useEffect, useContext, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import AppContent from "../context/AppContent.js";
import { invitationApi, organizationApi } from "../services";
import Navbar from "../components/Navbar.jsx";
import { toast } from "react-toastify";
import {
  MailCheck,
  Building,
  CheckCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { validateRedirect } from "../utils/validateRedirect.js";

const AcceptInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedin, getUserData } = useContext(AppContent);

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);

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
      const res = await organizationApi.acceptInviteToken(token);
      if (res.data?.success) {
        toast.success("Successfully joined the organization!");
        await getUserData();

        // Validate redirect path from location state
        const redirectPath =
          location.state?.redirect || location.state?.from?.pathname;
        const safePath = validateRedirect(redirectPath, "/dashboard");

        if (redirectPath && safePath !== redirectPath) {
          console.warn(
            "Invalid redirect path detected, using fallback:",
            safePath,
          );
        }

        navigate(safePath);
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pt-20">
      <Navbar />

      <div className="max-w-md mx-auto p-6 mt-12">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-6">
          {loading ? (
            <div className="py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
              <p className="text-sm text-slate-500">
                Validating invitation link...
              </p>
            </div>
          ) : error ? (
            <div className="space-y-4 py-4">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
              <h2 className="text-xl font-bold">Invitation Error</h2>
              <p className="text-sm text-slate-500">{error}</p>
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 font-medium text-sm"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <MailCheck className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl font-bold">You're Invited!</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  You have been invited to join an organization space on
                  MeetOnMemory.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-left border dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                  <Building className="w-4 h-4 text-blue-600" />
                  Organization:{" "}
                  <span className="font-bold">
                    {invitation?.organization?.name || "MeetOnMemory Team"}
                  </span>
                </div>
                <div className="text-slate-500">
                  Role:{" "}
                  <span className="capitalize font-semibold text-blue-600">
                    {invitation?.role || "member"}
                  </span>
                </div>
                {invitation?.message && (
                  <div className="pt-2 italic text-slate-400 border-t dark:border-slate-700">
                    "{invitation.message}"
                  </div>
                )}
              </div>

              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {accepting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                Accept & Join Organization
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;
