import React, { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ShieldAlert,
  TrendingUp,
  CheckCircle,
  Activity,
  BarChart2,
  RefreshCw,
  AlertCircle,
  Award,
  Target,
  Clock,
  ThumbsUp,
  FileCheck,
} from "lucide-react";
import { useEffectivenessScore } from "../hooks/useEffectivenessScore";
import apiClient from "../services/apiClient.js";

const MeetingEffectiveness = () => {
  const { meetingId } = useParams();
  const [searchParams] = useSearchParams();
  const organizationId = searchParams.get("orgId") || "demo-org-id";
  const seriesId = searchParams.get("seriesId");

  const {
    loading,
    error,
    meetingScore,
    orgTrends,
    seriesTrends,
    fetchMeetingScore,
    fetchOrgTrends,
    fetchSeriesTrends,
    clearError,
  } = useEffectivenessScore();

  const [actionedRecs, setActionedRecs] = React.useState({});
  const [actioningRec, setActioningRec] = React.useState(null);

  const handleCreateAction = async (recKey, text, description) => {
    setActioningRec(recKey);
    try {
      await apiClient.post(`/api/action-items/meetings/${meetingId}`, {
        text,
        description,
        priority: "medium",
      });
      setActionedRecs((prev) => ({ ...prev, [recKey]: true }));
    } catch (err) {
      console.error("Failed to create action item from recommendation:", err);
    } finally {
      setActioningRec(null);
    }
  };

  const getRecommendations = () => {
    if (!meetingScore || !meetingScore.dimensions) return [];
    const { dimensions } = meetingScore;
    const list = [];

    if ((dimensions.goalCompletionRate ?? 0) < 80) {
      list.push({
        key: "goals",
        title: "Improve Goal Alignment",
        description:
          "Define clearer goals at the start of meetings to improve alignment.",
        actionText:
          "Define SMART goals for the next recurring meeting and list them in the agenda.",
        icon: <Target className="text-blue-500" size={20} />,
      });
    }
    if ((dimensions.actionItemFollowThrough ?? 0) < 80) {
      list.push({
        key: "actions",
        title: "Follow up on Action Items",
        description:
          "Set explicit due dates and assignees for all action items.",
        actionText:
          "Review and assign clear due dates and owners to all open action items.",
        icon: <FileCheck className="text-indigo-500" size={20} />,
      });
    }
    if ((dimensions.participantSatisfaction ?? 0) < 80) {
      list.push({
        key: "satisfaction",
        title: "Boost Participant Satisfaction",
        description:
          "Collect feedback to improve attendee engagement and address concerns.",
        actionText:
          "Send a post-meeting engagement feedback survey to all attendees.",
        icon: <ThumbsUp className="text-emerald-500" size={20} />,
      });
    }
    if ((dimensions.decisionClarity ?? 0) < 80) {
      list.push({
        key: "clarity",
        title: "Enhance Meeting Clarity",
        description:
          "Summarize key decisions before ending the meeting to ensure agreement.",
        actionText:
          "Summarize decisions and update the decision log before the next meeting ends.",
        icon: <CheckCircle className="text-purple-500" size={20} />,
      });
    }
    if ((dimensions.timeEfficiency ?? 0) < 80) {
      list.push({
        key: "time",
        title: "Optimize Time Efficiency",
        description:
          "Strictly adhere to the agenda and assign a timekeeper to prevent going over time.",
        actionText:
          "Time-box each agenda item for the next meeting and assign a timekeeper.",
        icon: <Clock className="text-amber-500" size={20} />,
      });
    }

    return list;
  };

  const handleRefresh = () => {
    clearError();
    if (meetingId) {
      fetchMeetingScore(meetingId);
    }
    if (organizationId) {
      fetchOrgTrends(organizationId);
    }
    const activeSeriesId = seriesId || meetingScore?.seriesId;
    if (activeSeriesId) {
      fetchSeriesTrends(activeSeriesId);
    }
  };

  useEffect(() => {
    if (meetingId) {
      fetchMeetingScore(meetingId);
    }
    if (organizationId) {
      fetchOrgTrends(organizationId);
    }
  }, [meetingId, organizationId, fetchMeetingScore, fetchOrgTrends]);

  useEffect(() => {
    const activeSeriesId = seriesId || meetingScore?.seriesId;
    if (activeSeriesId) {
      fetchSeriesTrends(activeSeriesId);
    }
  }, [seriesId, meetingScore?.seriesId, fetchSeriesTrends]);

  const getScoreBadge = (score) => {
    if (score >= 80) {
      return {
        label: "Excellent",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        ring: "ring-emerald-500",
      };
    }
    if (score >= 60) {
      return {
        label: "Good",
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        ring: "ring-blue-500",
      };
    }
    return {
      label: "Needs Improvement",
      bg: "bg-amber-50 text-amber-700 border-amber-200",
      ring: "ring-amber-500",
    };
  };

  const renderRadarChart = () => {
    if (!meetingScore || !meetingScore.dimensions) return null;

    const { dimensions } = meetingScore;
    const data = [
      {
        subject: "Goals",
        A: dimensions.goalCompletionRate ?? 0,
        fullMark: 100,
      },
      {
        subject: "Action Items",
        A: dimensions.actionItemFollowThrough ?? 0,
        fullMark: 100,
      },
      {
        subject: "Satisfaction",
        A: dimensions.participantSatisfaction ?? 0,
        fullMark: 100,
      },
      {
        subject: "Clarity",
        A: dimensions.decisionClarity ?? 0,
        fullMark: 100,
      },
      {
        subject: "Time",
        A: dimensions.timeEfficiency ?? 0,
        fullMark: 100,
      },
    ];

    return (
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#475569", fontSize: 12 }}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" />
          <Radar
            name="Score"
            dataKey="A"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.5}
          />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    );
  };

  const renderLineChart = (data) => {
    if (!data || data.length === 0) return null;
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 12 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="averageScore"
            stroke="#10b981"
            strokeWidth={2}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderSparkline = (data) => {
    if (!data || data.length === 0) return null;
    return (
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="overallScore"
            stroke="#f97316"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#f97316" }}
          />
          <Tooltip />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart2 className="text-blue-600" size={32} />
            Meeting Effectiveness Scorecard
          </h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">
            Analyze post-meeting outcomes and dimensions to ensure your meetings
            deliver measurable value.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={`${loading ? "animate-spin text-blue-600" : ""}`}
          />
          Refresh Data
        </button>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={24} />
            <div>
              <h3 className="font-semibold text-red-800">
                Unable to Load Scorecard
              </h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !meetingScore && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
          <Activity className="animate-spin text-blue-600 mb-3" size={40} />
          <p className="text-gray-600 font-medium">
            Fetching effectiveness metrics...
          </p>
        </div>
      )}

      {/* No Meeting Selected Empty State */}
      {!loading && !meetingId && (
        <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-300 rounded-xl">
          <AlertCircle className="mx-auto mb-3 text-gray-400" size={44} />
          <h3 className="text-lg font-semibold text-gray-800 mb-1">
            No Meeting Selected
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
            Specify a meeting ID parameter in the URL route (e.g.,{" "}
            <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">
              /effectiveness/:meetingId
            </code>
            ) to view individual meeting scorecard dimensions.
          </p>
        </div>
      )}

      {/* Main Scorecard View */}
      {meetingScore && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Overall Score Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <Award className="text-blue-500 mb-2 opacity-80" size={32} />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Overall Effectiveness
              </h2>
              <div className="text-6xl font-extrabold text-gray-900 my-2">
                {meetingScore.overallScore ?? 0}
                <span className="text-lg font-normal text-gray-400">/100</span>
              </div>

              {(() => {
                const badge = getScoreBadge(meetingScore.overallScore ?? 0);
                return (
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg} mt-1`}
                  >
                    {badge.label}
                  </span>
                );
              })()}

              <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100 w-full justify-center">
                <CheckCircle size={14} className="text-emerald-500" />
                <span>Aggregated from 5 core performance metrics</span>
              </div>
            </div>

            {/* Dimension Breakdown Radar Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">
                Dimension Breakdown
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Visualizing goal attainment, action item completion, decision
                clarity, time efficiency, and attendee satisfaction.
              </p>
              {renderRadarChart()}
            </div>
          </div>

          {/* Metric Details Cards */}
          {meetingScore.dimensions && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-medium">Goals Rate</span>
                  <Target size={16} className="text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {meetingScore.dimensions.goalCompletionRate ?? 0}%
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-medium">Action Items</span>
                  <FileCheck size={16} className="text-indigo-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {meetingScore.dimensions.actionItemFollowThrough ?? 0}%
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-medium">Satisfaction</span>
                  <ThumbsUp size={16} className="text-emerald-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {meetingScore.dimensions.participantSatisfaction ?? 0}%
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-medium">Clarity</span>
                  <CheckCircle size={16} className="text-purple-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {meetingScore.dimensions.decisionClarity ?? 0}%
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-xs font-medium">Time Efficiency</span>
                  <Clock size={16} className="text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {meetingScore.dimensions.timeEfficiency ?? 0}%
                </div>
              </div>
            </div>
          )}

          {/* Actionable Recommendations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <ShieldAlert className="text-blue-600" size={20} />
              Actionable Recommendations
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Turn diagnostic findings into tracked improvement tasks.
            </p>

            {getRecommendations().length > 0 ? (
              <div className="space-y-4">
                {getRecommendations().map((rec) => {
                  const isActioned = actionedRecs[rec.key];
                  const isLoading = actioningRec === rec.key;

                  return (
                    <div
                      key={rec.key}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-150 transition-all hover:bg-gray-100/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm shrink-0">
                          {rec.icon}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 text-sm">
                            {rec.title}
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {rec.description}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          handleCreateAction(
                            rec.key,
                            rec.actionText,
                            rec.description,
                          )
                        }
                        disabled={isActioned || isLoading}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all shrink-0 ${
                          isActioned
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isLoading
                              ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                              : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-95"
                        }`}
                      >
                        {isActioned ? (
                          <>
                            <CheckCircle size={14} />
                            Actioned
                          </>
                        ) : isLoading ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Action Item"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center bg-emerald-50/50 rounded-lg border border-dashed border-emerald-200 text-emerald-800">
                <CheckCircle
                  className="mx-auto mb-2 text-emerald-600"
                  size={32}
                />
                <h4 className="font-semibold text-sm">All Metrics Healthy</h4>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Great job! All meeting effectiveness dimensions are currently
                  scored above 80.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trends Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {/* Organization Benchmark Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="text-emerald-600" size={22} />
              <h2 className="text-lg font-semibold text-gray-800">
                Organization Benchmark
              </h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Historical meeting effectiveness trends across your organization.
            </p>
          </div>

          {orgTrends.length > 0 ? (
            renderLineChart(orgTrends)
          ) : (
            <div className="py-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <p className="text-xs text-gray-400">
                No organization benchmark data available yet.
              </p>
            </div>
          )}
        </div>

        {/* Series Trend Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="text-orange-500" size={22} />
              <h2 className="text-lg font-semibold text-gray-800">
                Series Performance
              </h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Progression score for recurring meetings in this series.
            </p>
          </div>

          {seriesTrends.length > 0 ? (
            <div>
              {renderSparkline(seriesTrends)}
              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
                <span>Showing last {seriesTrends.length} meetings</span>
                <span className="font-medium text-gray-600">
                  Series ID: {seriesId}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <p className="text-xs text-gray-400">
                {seriesId
                  ? "No trend history found for this meeting series."
                  : "No recurring series specified for this meeting."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingEffectiveness;
