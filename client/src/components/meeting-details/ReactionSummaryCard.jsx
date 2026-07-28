import React, { useEffect, useState } from "react";
import { Smile } from "lucide-react";
import { meetingApi } from "../../services/meetingApi";

const ReactionSummaryCard = ({ meetingId }) => {
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const { data } = await meetingApi.getReactionSummary(meetingId);
        if (data.success) {
          // Sort by count descending
          const sorted = data.summary.sort((a, b) => b.count - a.count);
          setSummary(sorted);
        }
      } catch (err) {
        console.error("Failed to fetch reaction summary", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [meetingId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse mb-8">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
        <div className="flex gap-4">
          <div className="h-10 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div className="h-10 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (summary.length === 0) {
    return null; // Don't show if there are no reactions
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
          <Smile className="w-5 h-5 text-pink-600 dark:text-pink-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Meeting Reactions
        </h2>
      </div>

      <div className="flex flex-wrap gap-4">
        {summary.map(({ emoji, count }) => (
          <div
            key={emoji}
            className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2 shadow-sm"
          >
            <span className="text-2xl">{emoji}</span>
            <span className="text-lg font-semibold text-gray-700 dark:text-gray-300 ml-1">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReactionSummaryCard;
