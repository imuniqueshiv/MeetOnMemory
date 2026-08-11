import React, { useContext, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSignUp, useAuth, useClerk } from "@clerk/clerk-react";
import AppContent from "../context/AppContent";
import AuthPageShell from "../components/AuthPageShell";
import { toast } from "react-toastify";
import {
  Loader2,
  Mail,
  Lock,
  User,
  ArrowRight,
  RefreshCw,
  CheckCircle,
} from "lucide-react";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const resolveReturnUrl = (location, userData) => {
  const from = location.state?.from;
  const redirect = location.state?.redirect;
  return (
    (from?.pathname ? `${from.pathname}${from.search || ""}` : null) ||
    redirect ||
    (userData?.hasCompletedOnboarding === false
      ? "/organizations"
      : "/dashboard")
  );
};

const BootstrapPending = ({ title }) => (
  <AuthPageShell title={title}>
    <div className="text-center space-y-3 py-8">
      <div className="mx-auto h-8 w-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      <p className="text-slate-300 text-sm">Finishing sign-in…</p>
    </div>
  </AuthPageShell>
);

const SignUpInner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedin, userData, loading, initializeAuth, setLoading } =
    useContext(AppContent);
  const { isSignedIn, isLoaded: clerkAuthLoaded, getToken } = useAuth();
  const { isLoaded: signUpLoaded, signUp, setActive } = useSignUp();
  const { signOut } = useClerk();

  // Form state
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Single-flight execution locks to eliminate duplicate OTP email dispatches
  const submitLockRef = useRef(false);
  const resendLockRef = useRef(false);
  const cooldownTimerRef = useRef(null);

  const fallbackRedirectUrl = useMemo(
    () => resolveReturnUrl(location, userData),
    [location, userData],
  );

  useEffect(() => {
    if (!loading && isLoggedin && userData) {
      navigate(resolveReturnUrl(location, userData), { replace: true });
    }
  }, [loading, isLoggedin, userData, navigate, location]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownTimerRef.current = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, [resendCooldown]);

  if (!clerkAuthLoaded || !signUpLoaded || loading) {
    return <BootstrapPending title="Create your MeetOnMemory account" />;
  }

  if (isSignedIn && !isLoggedin) {
    return (
      <AuthPageShell title="Create your MeetOnMemory account">
        <div className="text-center space-y-4 py-6">
          <h1 className="text-xl font-semibold text-white">
            Couldn&apos;t finish sign-up
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your Clerk session is active, but MeetOnMemory could not load your
            account. Retry or sign out and try again.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition-colors"
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
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors"
              onClick={() => signOut({ redirectUrl: "/signup" })}
            >
              Sign out
            </button>
          </div>
        </div>
      </AuthPageShell>
    );
  }

  // Submit Registration Form (Single-Flight Protected)
  const handleSubmitSignUp = async (e) => {
    e.preventDefault();
    if (submitLockRef.current || isSubmitting) return;

    if (!emailAddress.trim() || !password) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const nameParts = fullName.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Step 1: Create Sign Up session in Clerk
      await signUp.create({
        emailAddress: emailAddress.trim(),
        password,
        firstName,
        lastName,
      });

      // Step 2: Dispatch exactly ONE OTP verification email
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

      setPendingVerification(true);
      setResendCooldown(60);
      toast.success("Verification code sent to your email!");
    } catch (err) {
      console.error("Sign-up error:", err);
      const msg =
        err.errors?.[0]?.longMessage ||
        err.errors?.[0]?.message ||
        err.message ||
        "Failed to create account. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  // Verify OTP Code
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (submitLockRef.current || isSubmitting) return;

    if (!code.trim()) {
      setErrorMessage("Please enter the 6-digit verification code.");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        toast.success("Account verified successfully!");
        navigate(fallbackRedirectUrl, { replace: true });
      } else {
        console.error("Incomplete sign up status:", completeSignUp);
        setErrorMessage("Verification incomplete. Please try again.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      const msg =
        err.errors?.[0]?.longMessage ||
        err.errors?.[0]?.message ||
        err.message ||
        "Invalid verification code. Please check and try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  // Resend OTP Email (Single-Flight Protected with Cooldown)
  const handleResendCode = async () => {
    if (resendLockRef.current || resendCooldown > 0) return;

    resendLockRef.current = true;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      toast.success("New verification code sent!");
      setResendCooldown(60);
      setErrorMessage("");
    } catch (err) {
      console.error("Resend OTP error:", err);
      const msg =
        err.errors?.[0]?.longMessage ||
        err.errors?.[0]?.message ||
        err.message ||
        "Failed to resend code.";
      toast.error(msg);
    } finally {
      resendLockRef.current = false;
    }
  };

  return (
    <AuthPageShell title="Create your MeetOnMemory account">
      <div className="w-full max-w-md mx-auto p-6 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl">
        {!pendingVerification ? (
          /* Sign Up Form */
          <form onSubmit={handleSubmitSignUp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 p-3 rounded-xl">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <span className="text-slate-400 text-xs">
                Already have an account?{" "}
              </span>
              <a
                href="/login"
                className="text-indigo-400 hover:text-indigo-300 text-xs font-medium underline"
              >
                Sign in
              </a>
            </div>
          </form>
        ) : (
          /* OTP Code Verification View */
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 mb-2">
                <Mail className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Check your email</h2>
              <p className="text-slate-400 text-xs mt-1">
                We sent a verification code to{" "}
                <span className="text-indigo-300 font-medium">
                  {emailAddress}
                </span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 text-center">
                Enter Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full text-center tracking-widest text-xl py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            {errorMessage && (
              <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 p-3 rounded-xl text-center">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Verify Email
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={() => setPendingVerification(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || isSubmitting}
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 disabled:text-slate-500 transition-colors font-medium"
              >
                <RefreshCw className="w-3 h-3" />
                {resendCooldown > 0
                  ? `Resend Code (${resendCooldown}s)`
                  : "Resend Code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthPageShell>
  );
};

const SignUpPage = () => {
  if (!clerkPubKey || clerkPubKey.trim().length === 0) {
    return (
      <AuthPageShell title="Sign up unavailable">
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

  return <SignUpInner />;
};

export default SignUpPage;
