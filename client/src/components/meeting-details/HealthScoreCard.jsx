import React, { useState, useEffect } from "react";
import { meetingHealthApi } from "../../services/meetingHealthApi";
import { toast } from "react-toastify";

const HealthScoreCard = ({ meetingId }) => {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setLoading(true);
        const res = await meetingHealthApi.getMeetingHealth(meetingId);
        if (res.success) {
          setHealthData(res.data);
        } else {
          toast.error("Failed to fetch meeting health");
        }
      } catch (error) {
        console.error("Failed to fetch meeting health", error);
        toast.error("Failed to fetch meeting health");
      } finally {
        setLoading(false);
      }
    };

    if (meetingId) {
      fetchHealth();
    }
  }, [meetingId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6 animate-pulse">
        <div className="h-6 w-1/3 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
        <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (!healthData) {
    return null; // Don't show anything if no data
  }

  const { compositeScore, factors, recommendations } = healthData;

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBg = (score) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Meeting Health Score
      </h3>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Overall Score */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-750 rounded-full w-32 h-32 border-4 border-gray-100 dark:border-gray-700">
          <span
            className={`text-3xl font-bold ${getScoreColor(compositeScore)}`}
          >
            {compositeScore}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            out of 100
          </span>
        </div>

        {/* Factors */}
        <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {Object.entries(factors).map(([key, value]) => (
            <div key={key} className="flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <span
                  className={`text-sm font-semibold ${getScoreColor(value)}`}
                >
                  {value}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`${getScoreBg(value)} h-2 rounded-full`}
                  style={{ width: `${value}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Recommendations
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            {recommendations.map((rec, index) => (
              <li
                key={index}
                className="text-sm text-gray-600 dark:text-gray-400"
              >
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default HealthScoreCard;
