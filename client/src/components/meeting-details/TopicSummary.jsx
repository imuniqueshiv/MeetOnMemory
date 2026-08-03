import React from "react";
import { Badge } from "@headlessui/react"; // if available, or just standard div

const formatTime = (seconds) => {
  if (seconds == null || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

const TopicSummary = ({ topics, onTopicClick }) => {
  if (!topics || topics.length === 0) return null;

  return (
    <div className="my-4">
      <h3 className="text-lg font-semibold mb-2">Discussion Topics</h3>
      <div className="flex flex-wrap gap-2">
        {topics.map((topic, index) => (
          <button
            type="button"
            key={topic._id || index}
            className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1 text-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            onClick={() => onTopicClick && onTopicClick(topic)}
          >
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {topic.name}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                topic.confidence >= 80
                  ? "bg-green-100 text-green-800"
                  : topic.confidence >= 50
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              {topic.confidence != null ? `${topic.confidence}%` : "N/A"}
            </span>
            {topic.timeRanges && topic.timeRanges.length > 0 && (
              <span className="text-xs text-gray-500 flex gap-1">
                {topic.timeRanges.slice(0, 1).map((tr, idx) => (
                  <span
                    key={idx}
                    className="bg-gray-200 dark:bg-gray-700 px-1 rounded"
                  >
                    {formatTime(tr.start)}
                  </span>
                ))}
                {topic.timeRanges.length > 1 && (
                  <span>+{topic.timeRanges.length - 1}</span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TopicSummary;
