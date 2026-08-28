import React, { useState, useEffect, useContext, useCallback } from "react";
import AppContent from "../context/AppContent";
import { meetingHealthApi } from "../services/meetingHealthApi";
import OrganizationEmptyState from "../components/organization/OrganizationEmptyState";

const MeetingHealthDashboard = () => {
  const { userData, loading: authLoading } = useContext(AppContent) || {};
  const organizationId =
    userData?.organization?._id || userData?.organization || null;

  const [trends, setTrends] = useState([]);
  const [benchmarks, setBenchmarks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTrends = useCallback(async () => {
    if (!organizationId) {
      setTrends([]);
      setBenchmarks(null);
      setError("");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res =
        await meetingHealthApi.getOrganizationHealthTrends(organizationId);
      if (res.success) {
        setTrends(res.data?.trends || []);
        setBenchmarks(res.data?.benchmarks || null);
      } else {
        setTrends([]);
        setBenchmarks(null);
        setError(res.message || "Failed to load meeting health trends");
      }
    } catch (err) {
      console.error("Failed to fetch trends", err);
      setTrends([]);
      setBenchmarks(null);
      setError(
        err.response?.data?.message || "Failed to load meeting health trends",
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (authLoading) return;
    fetchTrends();
  }, [authLoading, fetchTrends]);

  const renderLineChart = () => {
    if (trends.length === 0) {
      return (
        <p role="status" className="text-gray-500 dark:text-gray-400">
          No meeting health data available yet.
        </p>
      );
    }

    const width = 800;
    const height = 300;
    const padding = 40;
    const maxScore = 100;
    const minScore = 0;
    const xScale = (width - padding * 2) / Math.max(1, trends.length - 1);
    const yScale = (height - padding * 2) / (maxScore - minScore);

    const points = trends
      .map((t, i) => {
        const x = padding + i * xScale;
        const y = height - padding - (t.compositeScore - minScore) * yScale;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        aria-label="Meeting health composite score chart"
      >
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="currentColor"
          className="text-gray-300 dark:text-gray-600"
        />
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="currentColor"
          className="text-gray-300 dark:text-gray-600"
        />

        {[0, 25, 50, 75, 100].map((val) => (
          <g key={val}>
            <line
              x1={padding}
              y1={height - padding - val * yScale}
              x2={width - padding}
              y2={height - padding - val * yScale}
              stroke="currentColor"
              strokeDasharray="4"
              className="text-gray-200 dark:text-gray-700"
            />
            <text
              x={padding - 10}
              y={height - padding - val * yScale + 4}
              textAnchor="end"
              fontSize="12"
              fill="currentColor"
              className="text-gray-500 dark:text-gray-400"
            >
              {val}
            </text>
          </g>
        ))}

        <polyline
          fill="none"
          stroke="#3B82F6"
          strokeWidth="3"
          points={points}
        />

        {trends.map((t, i) => {
          const x = padding + i * xScale;
          const y = height - padding - (t.compositeScore - minScore) * yScale;
          return (
            <g key={t._id || i}>
              <circle cx={x} cy={y} r="4" fill="#2563EB" />
              <title>
                {t.meetingId?.title || "Meeting"}: {t.compositeScore}
              </title>
            </g>
          );
        })}
      </svg>
    );
  };

  const pageShellClass =
    "min-h-screen bg-gray-50 dark:bg-gray-900 p-6 flex justify-center items-center";

  if (authLoading || loading) {
    return (
      <div className={pageShellClass}>
        <div
          data-testid="meeting-health-loading"
          role="status"
          aria-label="Loading meeting health trends"
          aria-busy="true"
          className="animate-pulse h-32 w-full max-w-4xl bg-gray-200 dark:bg-gray-700 rounded-lg"
        />
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div
          data-testid="meeting-health-no-org"
          className="max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <OrganizationEmptyState />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div
            data-testid="meeting-health-error"
            role="alert"
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Organization Meeting Health
            </h1>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              {error}
            </p>
            <button
              type="button"
              onClick={fetchTrends}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="meeting-health-dashboard"
      data-organization-id={String(organizationId)}
      className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Organization Meeting Health
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              Average Composite Score
            </h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {benchmarks?.averageComposite || 0}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              Total Meetings Analyzed
            </h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {trends.length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              Avg Engagement
            </h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              {benchmarks?.averageEngagement || 0}%
            </p>
          </div>
        </div>

        <div
          role="region"
          aria-label="Composite score trend chart"
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Composite Score Trend
          </h2>
          <div className="overflow-x-auto">{renderLineChart()}</div>
        </div>

        {benchmarks && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Factor Benchmarks
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  label: "Agenda Coverage",
                  value: benchmarks.averageAgendaCoverage,
                },
                {
                  label: "Time Adherence",
                  value: benchmarks.averageTimeAdherence,
                },
                { label: "Engagement", value: benchmarks.averageEngagement },
                {
                  label: "Action Item Clarity",
                  value: benchmarks.averageActionItemClarity,
                },
                { label: "Sentiment", value: benchmarks.averageSentiment },
              ].map((factor) => (
                <div key={factor.label}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {factor.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {factor.value}%
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={factor.value}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${factor.label} percentage`}
                    className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"
                  >
                    <div
                      className={`h-2 rounded-full ${
                        factor.value >= 80
                          ? "bg-green-500"
                          : factor.value >= 60
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${factor.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingHealthDashboard;
