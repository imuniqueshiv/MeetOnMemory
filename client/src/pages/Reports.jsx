import React, { useEffect, useState, useContext } from "react";
import Navbar from "../components/Navbar.jsx";
import axios from "axios";
import { toast } from "react-toastify";
import { AppContent } from "../context/AppContext.jsx";
import { Bar, Line, Pie } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";
import { Loader2, Brain, BarChart4, PieChart } from "lucide-react";

Chart.register(...registerables);

const Reports = () => {
  const { backendUrl } = useContext(AppContent);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [aiInsights, setAiInsights] = useState("");

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // 🔹 Fetch summary stats + trends
  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/analytics`, {
        withCredentials: true,
      });

      if (res.data.success) {
        setData(res.data);
        await fetchAIInsights(res.data.summary);
      } else toast.error("Failed to load analytics.");
    } catch (err) {
      console.error("Analytics fetch error:", err);
      toast.error("Server error while fetching analytics.");
    } finally {
      setLoading(false);
    }
  };

  // 🧠 Generate Gemini-based insights
  const fetchAIInsights = async (summary) => {
    try {
      const res = await axios.post(`${backendUrl}/api/gemini/insights`, { summary });
      setAiInsights(res.data.insight || "AI analysis unavailable.");
    } catch {
      setAiInsights("AI insights unavailable — please try again later.");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <Loader2 className="animate-spin w-8 h-8 text-gray-500" />
        <span className="ml-3 text-gray-600">Loading analytics...</span>
      </div>
    );

  if (!data)
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center text-gray-600">
        No data available.
      </div>
    );

  const { summary, trends } = data;

  // Chart Data
  const meetingTrendData = {
    labels: trends.monthlyMeetings.map((t) => `Month ${t._id}`),
    datasets: [
      {
        label: "Meetings",
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
        label: "Policies",
        data: trends.monthlyPolicies.map((t) => t.count),
        backgroundColor: "rgba(16, 185, 129, 0.7)",
      },
    ],
  };

  const pieData = {
    labels: ["Completed Meetings", "Pending Meetings"],
    datasets: [
      {
        data: [summary.completedMeetings, summary.totalMeetings - summary.completedMeetings],
        backgroundColor: ["#6366F1", "#E5E7EB"],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto text-center pt-24 pb-20 px-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-2 flex justify-center items-center gap-2">
          <BarChart4 className="text-indigo-600 w-8 h-8" /> Reports & Analytics
        </h1>
        <p className="text-gray-600 mb-10">
          Visualize trends — meetings held, policies updated, and AI-powered insights.
        </p>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <StatCard title="Total Meetings" value={summary.totalMeetings} color="indigo" />
          <StatCard title="Completed Meetings" value={summary.completedMeetings} color="green" />
          <StatCard title="Total Policies" value={summary.totalPolicies} color="blue" />
          <StatCard title="Updated Policies" value={summary.updatedPolicies} color="purple" />
        </div>

        {/* Charts Section */}
        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-lg font-semibold mb-3">📈 Meetings Activity (6 Months)</h2>
            <Line data={meetingTrendData} />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-lg font-semibold mb-3">📊 Policies Activity (6 Months)</h2>
            <Bar data={policyTrendData} />
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-md max-w-2xl mx-auto mb-10">
          <h2 className="text-lg font-semibold mb-3 flex items-center justify-center gap-2">
            <PieChart className="text-indigo-600 w-5 h-5" /> Meetings Status
          </h2>
          <Pie data={pieData} />
        </div>

        {/* AI Insights Section */}
        <div className="bg-white p-6 rounded-xl shadow-md text-left">
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <Brain className="text-purple-600 w-6 h-6" /> AI Insights
          </h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
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
    indigo: "bg-indigo-50 text-indigo-700",
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <div className={`p-5 rounded-xl shadow-sm ${colorMap[color]} font-semibold`}>
      <h3 className="text-sm">{title}</h3>
      <p className="text-2xl mt-2">{value}</p>
    </div>
  );
};

export default Reports;
