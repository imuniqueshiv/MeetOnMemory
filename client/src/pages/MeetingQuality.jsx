import React, { useState, useEffect, useContext, useCallback } from "react";
import { useParams } from "react-router-dom";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Award,
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  Zap,
  CheckCircle,
  Star,
  Trophy,
  Lightbulb,
  Download,
  RefreshCw,
  ChevronRight,
  Info,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { toast } from "react-toastify";

const MeetingQuality = () => {
  const { meetingId } = useParams();
  const { userData, backendUrl } = useContext(AppContent);

  const [qualityData, setQualityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [recommendations, setRecommendations] = useState(null);

  const fetchRecommendations = useCallback(async () => {
    try {
      const response = await fetch(
        `${backendUrl}/api/quality/recommendations/${userData._id}`,
        { credentials: "include" },
      );

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    }
  }, [backendUrl, userData._id]);

  const triggerCalculation = useCallback(async () => {
    try {
      setCalculating(true);
      const response = await fetch(
        `${backendUrl}/api/quality/calculate/${meetingId}`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) throw new Error("Calculation failed");

      toast.info("Quality calculation started. This may take up to 5 seconds.");

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const checkResponse = await fetch(
            `${backendUrl}/api/quality/meeting/${meetingId}`,
            { credentials: "include" },
          );

          if (checkResponse.ok) {
            const data = await checkResponse.json();
            if (data.status === "completed") {
              clearInterval(pollInterval);
              setQualityData(data);
              setCalculating(false);
              toast.success("Quality score calculated!");
              fetchRecommendations();
            } else if (data.status === "failed") {
              clearInterval(pollInterval);
              setCalculating(false);
              toast.error("Quality calculation failed");
            }
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      }, 2000);

      // Stop polling after 30 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
        setCalculating(false);
      }, 30000);
    } catch (error) {
      console.error("Error triggering calculation:", error);
      toast.error("Failed to start calculation");
      setCalculating(false);
    }
  }, [backendUrl, meetingId, fetchRecommendations]);

  const fetchQualityData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${backendUrl}/api/quality/meeting/${meetingId}`,
        { credentials: "include" },
      );

      if (!response.ok) {
        const error = await response.json();
        if (error.status === "not_calculated") {
          toast.info("Calculating quality score...");
          await triggerCalculation();
          return;
        }
        throw new Error(error.message);
      }

      const data = await response.json();
      setQualityData(data);

      // Fetch recommendations
      fetchRecommendations();
    } catch (error) {
      console.error("Error fetching quality data:", error);
      toast.error("Failed to load quality data");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, meetingId, fetchRecommendations, triggerCalculation]);

  const fetchOrganizationData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${backendUrl}/api/quality/organization/${userData.organization}`,
        { credentials: "include" },
      );

      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      setQualityData(data);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load organization data");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, userData.organization]);

  useEffect(() => {
    if (meetingId) {
      fetchQualityData();
    } else {
      fetchOrganizationData();
    }
  }, [meetingId, fetchQualityData, fetchOrganizationData]);

  const getTierColor = (tier) => {
    const colors = {
      exceptional: "text-green-600 dark:text-green-400",
      excellent: "text-blue-600 dark:text-blue-400",
      good: "text-purple-600 dark:text-purple-400",
      average: "text-yellow-600 dark:text-yellow-400",
      "needs-improvement": "text-red-600 dark:text-red-400",
    };
    return colors[tier] || "text-gray-600 dark:text-gray-400";
  };

  const getTierBgColor = (tier) => {
    const colors = {
      exceptional: "bg-green-100 dark:bg-green-900/30",
      excellent: "bg-blue-100 dark:bg-blue-900/30",
      good: "bg-purple-100 dark:bg-purple-900/30",
      average: "bg-yellow-100 dark:bg-yellow-900/30",
      "needs-improvement": "bg-red-100 dark:bg-red-900/30",
    };
    return colors[tier] || "bg-gray-100 dark:bg-gray-900/30";
  };

  const getScoreColor = (score) => {
    if (score >= 85) return "text-green-600 dark:text-green-400";
    if (score >= 70) return "text-blue-600 dark:text-blue-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      medium:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    };
    return colors[priority] || colors.medium;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="pt-20 flex items-center justify-center">
          <div className="text-center">
            <Award className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              Loading quality data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!qualityData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="pt-20 max-w-4xl mx-auto px-4 py-8">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-8 text-center">
            <AlertCircle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-yellow-900 dark:text-yellow-100 mb-2">
              Quality Data Not Available
            </h2>
            <p className="text-yellow-700 dark:text-yellow-300 mb-4">
              {meetingId
                ? "Quality score has not been calculated for this meeting yet."
                : "No quality data available for your organization."}
            </p>
            {meetingId && (
              <button
                onClick={triggerCalculation}
                disabled={calculating}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {calculating ? "Calculating..." : "Calculate Quality Score"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const dimensionScores = qualityData.scores
    ? [
        {
          dimension: "Participation",
          score: qualityData.scores.participation,
          fullMark: 100,
        },
        {
          dimension: "Decision",
          score: qualityData.scores.decision,
          fullMark: 100,
        },
        {
          dimension: "Efficiency",
          score: qualityData.scores.efficiency,
          fullMark: 100,
        },
        {
          dimension: "Follow-Through",
          score: qualityData.scores.followThrough,
          fullMark: 100,
        },
        {
          dimension: "Satisfaction",
          score: qualityData.scores.satisfaction,
          fullMark: 100,
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <div className="pt-20 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                <Award className="w-8 h-8 text-blue-600" />
                {meetingId
                  ? "Meeting Quality Score"
                  : "Organization Quality Dashboard"}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {meetingId
                  ? qualityData.meeting?.title || "Meeting Analysis"
                  : "Track and improve meeting effectiveness across your organization"}
              </p>
            </div>
            {meetingId && (
              <button
                onClick={triggerCalculation}
                disabled={calculating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${calculating ? "animate-spin" : ""}`}
                />
                {calculating ? "Calculating..." : "Recalculate"}
              </button>
            )}
          </div>
        </div>

        {/* Overall Score Card */}
        {qualityData.scores && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  Overall Quality Score
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Weighted average of all quality dimensions
                </p>
              </div>
              <div className="text-right">
                <div
                  className={`text-6xl font-bold ${getScoreColor(qualityData.scores.overall)}`}
                >
                  {qualityData.scores.overall.toFixed(1)}
                </div>
                <div
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${getTierBgColor(
                    qualityData.qualityTier,
                  )} ${getTierColor(qualityData.qualityTier)}`}
                >
                  {qualityData.qualityTier.charAt(0).toUpperCase() +
                    qualityData.qualityTier.slice(1).replace("-", " ")}
                </div>
              </div>
            </div>

            {/* Dimension Scores */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {dimensionScores.map((dim) => (
                <div
                  key={dim.dimension}
                  className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {dim.dimension}
                    </span>
                    <span
                      className={`text-lg font-bold ${getScoreColor(dim.score)}`}
                    >
                      {dim.score.toFixed(0)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${dim.score}%`,
                        backgroundColor:
                          dim.score >= 85
                            ? "#10b981"
                            : dim.score >= 70
                              ? "#3b82f6"
                              : dim.score >= 50
                                ? "#f59e0b"
                                : "#ef4444",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Radar Chart */}
        {qualityData.scores && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Quality Dimensions
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={dimensionScores}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Badges */}
        {qualityData.badges && qualityData.badges.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              Badges Earned
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {qualityData.badges.map((badge, idx) => (
                <div
                  key={idx}
                  className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 text-center border border-yellow-200 dark:border-yellow-800"
                >
                  <div className="text-4xl mb-2">{badge.icon}</div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">
                    {badge.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {badge.description}
                  </p>
                  <span
                    className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${
                      badge.rarity === "legendary"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                        : badge.rarity === "epic"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          : badge.rarity === "rare"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
                    }`}
                  >
                    {badge.rarity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights */}
        {qualityData.insights && qualityData.insights.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-yellow-500" />
              AI-Powered Insights
            </h2>
            <div className="space-y-3">
              {qualityData.insights.map((insight, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-l-4 ${
                    insight.type === "strength"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-500"
                      : insight.type === "weakness"
                        ? "bg-red-50 dark:bg-red-900/20 border-red-500"
                        : insight.type === "recommendation"
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-500"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {insight.type === "strength" ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    ) : insight.type === "weakness" ? (
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-slate-900 dark:text-white font-medium mb-1">
                        {insight.message}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="capitalize">{insight.category}</span>
                        <span>•</span>
                        <span className="capitalize">
                          {insight.impact} impact
                        </span>
                        {insight.actionable && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600 dark:text-blue-400">
                              Actionable
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations && recommendations.recommendations && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-600" />
              Personalized Recommendations
            </h2>
            <div className="space-y-4">
              {recommendations.recommendations.slice(0, 3).map((rec, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-slate-900 dark:text-white">
                          {rec.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(
                            rec.priority,
                          )}`}
                        >
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        {rec.description}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Action Items:
                    </h4>
                    <ul className="space-y-1">
                      {rec.actionItems.map((item, itemIdx) => (
                        <li
                          key={itemIdx}
                          className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                        >
                          <ChevronRight className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Expected: {rec.expectedImprovement}</span>
                    <span>Timeframe: {rec.timeframe}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics Summary */}
        {qualityData.metrics && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Meeting Metrics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                Icon={Users}
                label="Participants"
                value={qualityData.metrics.participantCount}
              />
              <MetricCard
                Icon={Calendar}
                label="Duration"
                value={`${qualityData.metrics.duration} min`}
              />
              <MetricCard
                Icon={Target}
                label="Decisions"
                value={qualityData.metrics.decisionCount}
              />
              <MetricCard
                Icon={CheckCircle}
                label="Action Items"
                value={qualityData.metrics.actionItemCount}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({ Icon, label, value }) => (
  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      <span className="text-sm text-slate-600 dark:text-slate-400">
        {label}
      </span>
    </div>
    <div className="text-2xl font-bold text-slate-900 dark:text-white">
      {value}
    </div>
  </div>
);

export default MeetingQuality;
