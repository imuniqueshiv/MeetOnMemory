import React from "react";
import { useNavigate } from "react-router-dom";
import BrandLogo from "./branding/BrandLogo.jsx";

/**
 * Shared branded chrome for Clerk auth pages (logo + dark ambient layout).
 */
const AuthPageShell = ({ children, title }) => {
  const navigate = useNavigate();

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-linear-to-br from-blue-200 to-purple-400 dark:from-gray-900 dark:to-slate-900 overflow-hidden px-4 sm:px-6">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[128px]" />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[128px]"
          style={{ animationDelay: "2s" }}
        />
        <div className="absolute top-[40%] left-[50%] translate-x-[-50%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[96px]" />
      </div>

      <BrandLogo
        onClick={() => navigate("/")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate("/");
          }
        }}
        alt="MeetOnMemory"
        role="link"
        tabIndex={0}
        className="absolute left-5 sm:left-20 top-5 w-28 sm:w-32 cursor-pointer transition-all duration-300 hover:scale-105 hover:opacity-90 z-20"
      />

      <div
        className="relative w-full max-w-md bg-slate-900 backdrop-blur-2xl border border-slate-700/40 rounded-2xl shadow-2xl shadow-black/20 p-8 sm:p-10 z-10 transition-all duration-300 flex flex-col items-center"
        aria-label={title}
      >
        {children}
      </div>
    </div>
  );
};

export default AuthPageShell;
