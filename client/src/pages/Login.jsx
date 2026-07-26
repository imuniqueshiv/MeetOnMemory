import { useNavigate, useLocation } from "react-router-dom";
import React, { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AppContent from "../context/AppContent";
import { toast } from "react-toastify";
import { assets } from "../assets/assets";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authApi, csrfService } from "../services";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { initializeAuth, isLoggedin, userData, loading } =
    useContext(AppContent);
  const { t } = useTranslation();

  const [state, setState] = useState("Login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    if (mode === "signup") {
      setState("Sign Up");
    }
  }, [location.search]);

  // Already signed in — leave the login page
  useEffect(() => {
    if (!loading && isLoggedin && userData) {
      navigate(
        userData.hasCompletedOnboarding ? "/dashboard" : "/organizations",
        { replace: true },
      );
    }
  }, [loading, isLoggedin, userData, navigate]);

  const finishAuth = async (welcomeName) => {
    const user = await initializeAuth();
    if (!user) {
      toast.error("Could not restore your session. Please try again.");
      return;
    }

    toast.success(`Welcome, ${welcomeName || user.name}!`);

    const from = location.state?.from?.pathname;
    if (from) {
      navigate(from, { replace: true });
      return;
    }

    navigate(user.hasCompletedOnboarding ? "/dashboard" : "/organizations");
  };

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Ensure we have a valid CSRF token before any auth POST
      await csrfService.fetchToken();

      if (state === "Sign Up") {
        const { data } = await authApi.register({
          name,
          email,
          password,
        });

        if (!data.success) {
          toast.error(data.message || "Register failed");
          return;
        }

        toast.success("Account created successfully!");
        // Register already sets the session cookie
        await finishAuth(name);
        return;
      }

      const { data: loginData } = await authApi.login({
        email,
        password,
      });

      if (loginData.success) {
        await finishAuth();
      } else {
        toast.error(loginData.message || "Login failed");
      }
    } catch (error) {
      const msg = error.response?.data?.message || "Network or server error.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-linear-to-br from-blue-200 to-purple-400 dark:from-gray-900 dark:to-slate-900 overflow-hidden px-4 sm:px-6">
      {/* Ambient background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[128px] " />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[128px] "
          style={{ animationDelay: "2s" }}
        />
        <div className="absolute top-[40%] left-[50%] translate-x-[-50%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[96px]" />
      </div>

      {/* Logo */}
      <img
        onClick={() => navigate("/")}
        src={assets.logo}
        alt="Logo"
        className="absolute left-5 sm:left-20 top-5 w-28 sm:w-32 cursor-pointer transition-all duration-300 hover:scale-105 hover:opacity-90 z-20"
      />

      {/* Auth Card */}
      <div className="relative w-full max-w-md bg-slate-900 backdrop-blur-2xl border border-slate-700/40 rounded-2xl shadow-2xl shadow-black/20 p-8 sm:p-10 z-10 transition-all duration-300">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
            {state === "Sign Up"
              ? t("login.createAccount")
              : t("login.welcomeBack")}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            {state === "Sign Up"
              ? t("login.joinUs")
              : t("login.signInContinue")}
          </p>
        </div>

        <form onSubmit={onSubmitHandler} className="space-y-5">
          {/* Name Field */}
          {state === "Sign Up" && (
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1"
              >
                {t("login.fullName")}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <img
                    src={assets.person_icon}
                    alt=""
                    className="w-5 h-5 text-slate-500 opacity-70"
                  />
                </div>
                <input
                  id="name"
                  onChange={(e) => setName(e.target.value)}
                  value={name}
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-800/40 border border-slate-600/40 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition-all duration-200 focus:border-indigo-400/60 focus:bg-slate-800/60 focus-visible:ring-2 focus:ring-indigo-400/20 hover:border-slate-500/60"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1"
            >
              {t("login.emailAddress")}
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <img
                  src={assets.mail_icon}
                  alt=""
                  className="w-5 h-5 text-slate-500 opacity-70"
                />
              </div>
              <input
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                value={email}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-800/40 border border-slate-600/40 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition-all duration-200 focus:border-indigo-400/60 focus:bg-slate-800/60 focus-visible:ring-2 focus:ring-indigo-400/20 hover:border-slate-500/60"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1"
            >
              {t("login.password")}
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <img
                  src={assets.lock_icon}
                  alt=""
                  className="w-5 h-5 text-slate-500 opacity-70"
                />
              </div>
              <input
                id="password"
                onChange={(e) => setPassword(e.target.value)}
                value={password}
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                className="w-full pl-11 pr-12 py-3 bg-slate-800/40 border border-slate-600/40 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition-all duration-200 focus:border-indigo-400/60 focus:bg-slate-800/60 focus-visible:ring-2 focus:ring-indigo-400/20 hover:border-slate-500/60"
              />
              <button
                type="button"
                autocomple
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex cursor-pointer items-center text-slate-500 hover:text-indigo-400 transition-colors duration-200 outline-none focus:text-indigo-400"
                aria-label={
                  showPassword
                    ? t("login.hidePassword")
                    : t("login.showPassword")
                }
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Forgot Password */}
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={() => navigate("/reset-password")}
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors duration-200 cursor-pointer outline-none focus:underline underline-offset-2"
            >
              {t("login.forgotPassword")}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl cursor-pointer bg-linear-to-r from-indigo-500 to-indigo-900 text-white font-semibold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:translate-y-[-2px] active:translate-y-0 active:shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {state === "Sign Up"
                    ? t("login.creatingAccount")
                    : t("login.signingIn")}
                </span>
              </>
            ) : state === "Sign Up" ? (
              t("login.signUp")
            ) : (
              t("login.loginBtn")
            )}
          </button>
        </form>

        {/* Toggle State */}
        <div className="mt-8 pt-6 border-t border-slate-700/40 text-center ">
          <p className="text-slate-400 text-sm">
            {state === "Sign Up" ? (
              <>
                {t("login.alreadyHaveAccount")}{" "}
                <button
                  type="button"
                  onClick={() => setState("Login")}
                  className="text-indigo-400 cursor-pointer font-semibold hover:text-indigo-300 transition-colors duration-200 outline-none focus:underline underline-offset-2"
                >
                  {t("login.signIn")}
                </button>
              </>
            ) : (
              <>
                {t("login.dontHaveAccount")}{" "}
                <button
                  type="button"
                  onClick={() => setState("Sign Up")}
                  className="text-indigo-400 font-semibold cursor-pointer hover:text-indigo-300 transition-colors duration-200 outline-none focus:underline underline-offset-2"
                >
                  {t("login.signUpLink")}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
