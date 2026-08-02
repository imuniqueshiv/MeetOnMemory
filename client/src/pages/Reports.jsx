import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "../components/Navbar.jsx";
import { toast } from "react-toastify";
import AppContent from "../context/AppContent";
import { analyticsApi } from "../services";
import reportApi from "../services/reportApi";
import { Bar, Line, Pie } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";
import {
  Loader2,
  Brain,
  BarChart4,
  PieChart,
  Plus,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

Chart.register(...registerables);

const Reports = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [aiInsights, setAiInsights] = useState("");
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    // 🧠 Generate Gemini-based insights
    const fetchAIInsights = async (summary) => {
      try {
        const aiRes = await analyticsApi.askAnalyticsChat({ summary });
        if (aiRes.data.success) {
          setAiInsights(aiRes.data.insight);
        } else {
          setAiInsights(t("reports.aiInsightsUnavailable"));
        }
      } catch (err) {
        console.error("AI Insights error:", err);
        setAiInsights(t("reports.aiInsightsUnavailable"));
      }
    };

    const fetchAnalytics = async () => {
      try {
        const [res, templatesRes] = await Promise.all([
          analyticsApi.getAnalytics(),
          reportApi.getTemplates().catch(() => ({ data: [] })),
        ]);

        if (res.data.success) {
          setData(res.data);
          await fetchAIInsights(res.data.summary);
        } else {
          toast.error(t("reports.failedToLoad"));
        }

        if (templatesRes && templatesRes.data) {
          setTemplates(templatesRes.data);
        }
      } catch (error) {
        console.error("Error loading analytics:", error);
        toast.error(t("reports.errorLoading"));
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [t]);

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex justify-center items-center">
        <Loader2 className="animate-spin w-8 h-8 text-gray-500 dark:text-gray-400" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          {t("reports.loading")}
        </span>
      </div>
    );

  if (!data)
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex justify-center items-center text-gray-600 dark:text-gray-400">
        {t("common.noResults")}
      </div>
    );

  const { summary, trends } = data;

  // Chart Data
  const meetingTrendData = {
    labels: trends.monthlyMeetings.map((t) => `Month ${t._id}`),
    datasets: [
      {
        label: t("navbar.meetings"),
        data: trends.monthlyMeetings.map((t) => t.count),
        borderColor: "#4F46E5",
        backgroundColor: "rgba(99, 102, 241, 0.5)",
      },
    ],
  };

  const policyTrendData = {
    labels: trends.monthlyPolicies.map((t) => `Month ${t._id}`),
    datasets: [
      {
        label: t("navbar.compliance"),
        data: trends.monthlyPolicies.map((t) => t.count),
        backgroundColor: "rgba(16, 185, 129, 0.7)",
      },
    ],
  };

  const pieData = {
    labels: [
      t("reports.completedMeetings", "Completed Meetings"),
      t("reports.pendingMeetings", "Pending Meetings"),
    ],
    datasets: [
      {
        data: [
          summary.completedMeetings,
          summary.totalMeetings - summary.completedMeetings,
        ],
        backgroundColor: ["#6366F1", "rgba(148, 163, 184, 0.3)"],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200">
      <Navbar />
      <div className="max-w-6xl mx-auto text-center pt-24 pb-20 px-6">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 flex justify-center items-center gap-2">
          <BarChart4 className="text-indigo-600 dark:text-indigo-400 w-8 h-8" />{" "}
          {t("reports.title")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-10">
          {t("dashboard.reportsAnalyticsDesc")}
        </p>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <StatCard
            title={t("reports.totalMeetings", "Total Meetings")}
            value={summary.totalMeetings}
            color="indigo"
          />
          <StatCard
            title={t("reports.completedMeetings", "Completed Meetings")}
            value={summary.completedMeetings}
            color="green"
          />
          <StatCard
            title={t("reports.totalPolicies", "Total Policies")}
            value={summary.totalPolicies}
            color="blue"
          />
          <StatCard
            title={t("reports.updatedPolicies", "Updated Policies")}
            value={summary.updatedPolicies}
            color="purple"
          />
        </div>

        {/* Charts Section */}
        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-md border dark:border-gray-800">
            <h2 className="text-lg font-semibold dark:text-white mb-3">
              📈 {t("reports.meetingTrends")}
            </h2>
            <Line data={meetingTrendData} />
          </div>

          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-md border dark:border-gray-800">
            <h2 className="text-lg font-semibold dark:text-white mb-3">
              📊 {t("reports.policyActivity")}
            </h2>
            <Bar data={policyTrendData} />
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-md border dark:border-gray-800 max-w-2xl mx-auto mb-10">
          <h2 className="text-lg font-semibold dark:text-white mb-3 flex items-center justify-center gap-2">
            <PieChart className="text-indigo-600 dark:text-indigo-400 w-5 h-5" />{" "}
            {t("reports.meetingDistribution")}
          </h2>
          <Pie data={pieData} />
        </div>

        {/* Custom Report Builder */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-md border dark:border-gray-800 text-left mb-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold dark:text-white flex items-center gap-2">
              <FileText className="text-blue-600 dark:text-blue-400 w-6 h-6" />
              Custom Reports
            </h2>
            <button
              onClick={() => navigate("/reports/builder")}
              className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-medium"
            >
              <Plus size={16} className="mr-2" />
              New Template
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
              No custom report templates yet. Create one to generate aggregated
              meeting reports.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <div
                  key={template._id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-gray-50 dark:bg-gray-800/50"
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4 truncate">
                    {template.description || "No description"}
                  </p>
                  <div className="flex justify-between items-center mt-auto">
                    <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                      {template.sections?.length || 0} sections
                    </span>
                    <button
                      onClick={() =>
                        navigate(`/reports/builder/${template._id}`)
                      }
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      View / Generate &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Insights Section */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-md border dark:border-gray-800 text-left">
          <h2 className="text-xl font-semibold dark:text-white mb-3 flex items-center gap-2">
            <Brain className="text-purple-600 dark:text-purple-400 w-6 h-6" />{" "}
            {t("reports.aiInsights")}
          </h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {aiInsights}
          </p>
        </div>
      </div>
    </div>
  );
};

// 🔹 Stats Card Component
const StatCard = ({ title, value, color }) => {
  const colorMap = {
    indigo:
      "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border dark:border-indigo-900/50",
    green:
      "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border dark:border-green-900/50",
    blue: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border dark:border-blue-900/50",
    purple:
      "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border dark:border-purple-900/50",
  };
  return (
    <div
      className={`p-5 rounded-xl shadow-sm ${colorMap[color]} font-semibold`}
    >
      <h3 className="text-sm">{title}</h3>
      <p className="text-2xl mt-2">{value}</p>
    </div>
  );
};

export default Reports;
