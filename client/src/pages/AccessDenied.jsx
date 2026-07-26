import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldAlert, ArrowLeft, LayoutDashboard } from "lucide-react";

const AccessDenied = ({ fullPage = true }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const content = (
    <div className="flex flex-col items-center justify-center text-center px-4 py-16 max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6">
        <ShieldAlert className="w-8 h-8 text-red-500 dark:text-red-400" />
      </div>

      <p className="text-sm font-bold tracking-widest text-red-500 dark:text-red-400 uppercase mb-2">
        {t("accessDenied.code")}
      </p>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-3">
        {t("accessDenied.title")}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
        {t("accessDenied.description")}
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("accessDenied.goBack")}
        </button>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
        >
          <LayoutDashboard className="w-4 h-4" />
          {t("accessDenied.returnDashboard")}
        </button>
      </div>
    </div>
  );

  if (!fullPage) return content;

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
      {content}
    </div>
  );
};

export default AccessDenied;
