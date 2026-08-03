import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { meetingHealthApi } from "../services/meetingHealthApi";

const MeetingHealthDashboard = () => {
  const { user } = useAuth();
  const [trends, setTrends] = useState([]);
  const [benchmarks, setBenchmarks] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        if (!user?.organization) return;
        setLoading(true);
        const res = await meetingHealthApi.getOrganizationHealthTrends(
          user.organization,
        );
        if (res.success) {
          setTrends(res.data.trends);
          setBenchmarks(res.data.benchmarks);
        }
      } catch (error) {
        console.error("Failed to fetch trends", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTrends();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 flex justify-center items-center">
        <div className="animate-pulse h-32 w-full max-w-4xl bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  // Draw simple SVG line chart
  const renderLineChart = () => {
    if (trends.length === 0)
      return (
        <div className="text-gray-500">
          No meeting health data available yet.
        </div>
      );

    const width = 800;
    const height = 300;
    const padding = 40;

    // Scale data to fit within padding
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
      >
        {/* Y Axis */}
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="currentColor"
          className="text-gray-300 dark:text-gray-600"
        />
        {/* X Axis */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="currentColor"
          className="text-gray-300 dark:text-gray-600"
        />

        {/* Grid lines & Y labels */}
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

        {/* Data Line */}
        <polyline
          fill="none"
          stroke="#3B82F6"
          strokeWidth="3"
          points={points}
        />

        {/* Data Points */}
        {trends.map((t, i) => {
          const x = padding + i * xScale;
          const y = height - padding - (t.compositeScore - minScore) * yScale;
          return (
            <g key={t._id}>
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Organization Meeting Health
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Composite Score Card */}
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

        {/* Trend Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Composite Score Trend
          </h2>
          <div className="overflow-x-auto">{renderLineChart()}</div>
        </div>

        {/* Factors Breakdown */}
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
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${factor.value >= 80 ? "bg-green-500" : factor.value >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${factor.value}%` }}
                    ></div>
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
