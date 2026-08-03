import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Loader2,
  LogIn,
  Video,
} from "lucide-react";
import { toast } from "react-toastify";
import AppContent from "../context/AppContent.js";
import { meetingApi } from "../services";
import Navbar from "../components/Navbar.jsx";

const MeetingInviteJoin = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { isLoggedin, loading: authLoading } = useContext(AppContent);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const invitePath = `/meeting-invite/${code || ""}`;

  const resolve = useCallback(async () => {
    if (!code) {
      setError("Missing invite code.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await meetingApi.resolveInvite(code);
      const data = res.data || {};
      setResult(data);

      if (data.action === "live" && data.path) {
        toast.success("Invite validated. Joining live meeting...");
        navigate(data.path, { replace: true });
        return;
      }

      if (data.action === "details" && data.path) {
        toast.success(data.reason || "Opening meeting details...");
        navigate(data.path, { replace: true });
        return;
      }

      if (data.action === "blocked") {
        setError(data.reason || "This invite cannot be used right now.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Invalid, expired, or unauthorized meeting invite.",
      );
    } finally {
      setLoading(false);
    }
  }, [code, navigate]);

  useEffect(() => {
    if (authLoading) return;

    if (!isLoggedin) {
      setLoading(false);
      return;
    }

    resolve();
  }, [authLoading, isLoggedin, resolve]);

  const goLogin = () => {
    navigate("/login", {
      state: {
        from: { pathname: invitePath },
        redirect: invitePath,
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-20 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Navbar />

      <div className="mx-auto mt-12 max-w-md p-6">
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {authLoading || loading ? (
            <div className="py-12">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-sm text-slate-500">
                Validating meeting invite...
              </p>
            </div>
          ) : !isLoggedin ? (
            <div className="space-y-4 py-4">
              <Video className="mx-auto h-12 w-12 text-indigo-600" />
              <h1 className="text-xl font-bold">Join meeting</h1>
              <p className="text-sm text-slate-500">
                Sign in to continue with this invite link. We will bring you
                back here after authentication.
              </p>
              <button
                type="button"
                onClick={goLogin}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <LogIn className="h-4 w-4" />
                Continue to login
              </button>
            </div>
          ) : error ? (
            <div className="space-y-4 py-4">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
              <h1 className="text-xl font-bold">Invite unavailable</h1>
              <p className="text-sm text-slate-500">{error}</p>
              <button
                type="button"
                onClick={() => navigate("/meetings")}
                className="w-full rounded-xl bg-slate-200 py-2.5 text-sm font-medium dark:bg-slate-800"
              >
                Go to meetings
              </button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h1 className="text-xl font-bold">
                {result?.meeting?.title || "Meeting invite"}
              </h1>
              <p className="text-sm text-slate-500">
                Invite validated. Redirecting you to the meeting...
              </p>
              {result?.meeting?.date && (
                <p className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(result.meeting.date).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingInviteJoin;
