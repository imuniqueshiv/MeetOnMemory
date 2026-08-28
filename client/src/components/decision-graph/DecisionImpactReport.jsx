import React from "react";
import { useDecisionImpactReport } from "../../hooks/useDecisionImpact.js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const DecisionImpactReport = () => {
  const { reportData, loading, error } = useDecisionImpactReport();

  if (loading)
    return <div className="p-4 text-gray-500">Loading report...</div>;
  if (error)
    return (
      <div className="p-4 text-red-500">Error loading report: {error}</div>
    );
  if (!reportData || reportData.length === 0) {
    return (
      <div className="p-4 text-gray-500">
        No decision impact data available yet.
      </div>
    );
  }

  // Format data for chart
  const chartData = reportData.map((d) => ({
    name: d._id.charAt(0).toUpperCase() + d._id.slice(1),
    count: d.count,
    avgScore: Math.round(d.avgImpactScore || 0),
  }));

  const totalDecisions = chartData.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-6">
        Decision Impact & Outcome Report
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-blue-600 text-sm font-semibold mb-1">
            Tracked Decisions
          </div>
          <div className="text-3xl font-bold text-blue-900">
            {totalDecisions}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-green-600 text-sm font-semibold mb-1">
            Success Rate
          </div>
          <div className="text-3xl font-bold text-green-900">
            {totalDecisions > 0
              ? Math.round(
                  ((chartData.find((d) => d.name === "Success")?.count || 0) /
                    totalDecisions) *
                    100,
                )
              : 0}
            %
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-purple-600 text-sm font-semibold mb-1">
            Avg Impact Score
          </div>
          <div className="text-3xl font-bold text-purple-900">
            {totalDecisions > 0
              ? Math.round(
                  chartData.reduce(
                    (acc, curr) => acc + curr.avgScore * curr.count,
                    0,
                  ) / totalDecisions,
                )
              : 0}
            /100
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#82ca9d"
              domain={[0, 100]}
            />
            <Tooltip />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="count"
              name="Number of Decisions"
              fill="#8884d8"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              yAxisId="right"
              dataKey="avgScore"
              name="Average Impact Score"
              fill="#82ca9d"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DecisionImpactReport;
