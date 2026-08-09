import React, { useEffect, useState } from "react";
import { meetingApi } from "../../services";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const AgendaPacingReport = ({ meetingId }) => {
  const [reportData, setReportData] = useState([]);
  const [summaryStats, setSummaryStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await meetingApi.getAgendaPacingReport(meetingId);
        if (res.data.success) {
          setReportData(res.data.reportData);
          setSummaryStats(res.data.summaryStats);
        } else {
          setError("Failed to load pacing report.");
        }
      } catch (err) {
        console.error("Error fetching pacing report:", err);
        setError("Error loading pacing report.");
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [meetingId]);

  if (loading)
    return <div className="animate-pulse h-64 bg-gray-200 rounded-lg"></div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!reportData || reportData.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Agenda Pacing Report
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-500">Planned Time</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {summaryStats.totalPlanned} min
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-500">Actual Time</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {summaryStats.totalActual} min
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-500">Items Over Time</p>
          <p className="text-xl font-semibold text-amber-600">
            {summaryStats.itemsOverTime}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-500">Items Skipped</p>
          <p className="text-xl font-semibold text-gray-600">
            {summaryStats.itemsSkipped}
          </p>
        </div>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={reportData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="text" tick={{ fill: "#6B7280" }} />
            <YAxis
              label={{
                value: "Minutes",
                angle: -90,
                position: "insideLeft",
                fill: "#6B7280",
              }}
              tick={{ fill: "#6B7280" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                borderColor: "#374151",
                color: "#F9FAFB",
              }}
              itemStyle={{ color: "#F9FAFB" }}
            />
            <Legend wrapperStyle={{ paddingTop: "20px" }} />
            <Bar
              dataKey="plannedDuration"
              name="Planned (min)"
              fill="#93C5FD"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="actualDuration"
              name="Actual (min)"
              fill="#3B82F6"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AgendaPacingReport;
