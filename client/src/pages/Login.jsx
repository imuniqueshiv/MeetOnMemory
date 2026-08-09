import React, { useContext, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SignIn, useAuth, useClerk } from "@clerk/clerk-react";
import AppContent from "../context/AppContent";

import { validateRedirect } from "../utils/validateRedirect";
import AuthPageShell from "../components/AuthPageShell";
import {
  meetOnMemoryClerkAppearance,
  meetOnMemoryClerkInitialValues,
} from "../config/clerkAppearance";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const resolveReturnUrl = (location, userData) => {
  const from = location.state?.from;
  const redirect = location.state?.redirect;

  const rawUrl =
    (from?.pathname ? `${from.pathname}${from.search || ""}` : null) ||
    redirect;
  const defaultRedirect =
    userData?.hasCompletedOnboarding === false
      ? "/organizations"
      : "/dashboard";

  return validateRedirect(rawUrl, defaultRedirect);
};

const BootstrapPending = ({ title }) => (
  <AuthPageShell title={title}>
    <div className="text-center space-y-3 py-8">
      <div className="mx-auto h-8 w-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      <p className="text-slate-300 text-sm">Finishing sign-in…</p>
    </div>
  </AuthPageShell>
);

const LoginInner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedin, userData, loading, initializeAuth, setLoading } =
    useContext(AppContent);
  const { isSignedIn, isLoaded: clerkLoaded, getToken } = useAuth();
  const { signOut } = useClerk();

  const fallbackRedirectUrl = useMemo(
    () => resolveReturnUrl(location, userData),
    [location, userData],
  );

  useEffect(() => {
    if (!loading && isLoggedin && userData) {
      navigate(resolveReturnUrl(location, userData), { replace: true });
    }
  }, [loading, isLoggedin, userData, navigate, location]);

  // Never mount <SignIn /> while Clerk is still loading or Mongo bootstrap runs —
  // Clerk auto-redirects signed-in users to fallbackRedirectUrl and that fights
  // ProtectedRoute's Navigate to /login.
  if (!clerkLoaded || loading) {
    return <BootstrapPending title="Sign in to MeetOnMemory" />;
  }

  if (isSignedIn && !isLoggedin) {
    return (
      <AuthPageShell title="Sign in to MeetOnMemory">
        <div className="text-center space-y-4 py-6">
          <h1 className="text-xl font-semibold text-white">
            Couldn&apos;t finish sign-in
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your Clerk session is active, but MeetOnMemory could not load your
            account. Retry or sign out and try again.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400"
              onClick={async () => {
                setLoading(true);
                try {
                  const token = await getToken();
                  await initializeAuth(
                    token ? { authorization: `Bearer ${token}` } : {},
                  );
                } finally {
                  setLoading(false);
                }
              }}
            >
              Retry
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800"
              onClick={() => signOut({ redirectUrl: "/login" })}
            >
              Sign out
            </button>
          </div>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell title="Sign in to MeetOnMemory">
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/signup"
        fallbackRedirectUrl={fallbackRedirectUrl}
        appearance={meetOnMemoryClerkAppearance}
        initialValues={meetOnMemoryClerkInitialValues}
      />
    </AuthPageShell>
  );
};

const Login = () => {
  if (!clerkPubKey || clerkPubKey.trim().length === 0) {
    return (
      <AuthPageShell title="Sign in unavailable">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Authentication unavailable
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            MeetOnMemory requires Clerk. Set{" "}
            <code className="text-indigo-300">VITE_CLERK_PUBLISHABLE_KEY</code>{" "}
            and restart the client.
          </p>
        </div>
      </AuthPageShell>
    );
  }

  return <LoginInner />;
};

export default Login;
