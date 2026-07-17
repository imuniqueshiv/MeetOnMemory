import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";

const AccessDenied = ({ fullPage = true }) => {
  const navigate = useNavigate();

  const content = (
    <div className="flex flex-col items-center text-center px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/30 ring-1 ring-red-100 dark:ring-red-800/50 mb-6">
        <ShieldAlert className="h-10 w-10 text-red-500 dark:text-red-400" />
      </div>

      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
        403
      </h1>
      <h2 className="mt-3 text-xl font-semibold text-gray-800 dark:text-gray-200">
        Access Denied
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">
        You do not have the required permissions to access this page. Please
        contact your administrator if you believe this is a mistake.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
        <button
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
        >
          <Home className="w-4 h-4" />
          Return to Dashboard
        </button>
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        {content}
      </div>
    );
  }

  return content;
};

export default AccessDenied;
