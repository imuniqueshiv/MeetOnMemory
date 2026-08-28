import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Layers, RefreshCw, Sparkles } from "lucide-react";
import { topicApi } from "../../services/topicApi";

const CARD_CLASS =
  "bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6";

const formatTime = (seconds) => {
  if (seconds == null || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

const getErrorMessage = (err, fallback) =>
  err.response?.data?.error || err.response?.data?.message || fallback;

const normalizeTopics = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.topics)) return payload.topics;
  return [];
};

const TopicSummary = ({ meetingId, canExtract = true, onTopicClick }) => {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(Boolean(meetingId));
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");

  const fetchTopics = useCallback(async () => {
    if (!meetingId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const { data } = await topicApi.getTopicsForMeeting(meetingId);
      if (data?.success === false) {
        setTopics([]);
        setError(data.error || data.message || "Failed to load topics");
        return;
      }
      setTopics(normalizeTopics(data?.data ?? data));
    } catch (err) {
      console.error("Error fetching meeting topics:", err);
      setTopics([]);
      setError(getErrorMessage(err, "Failed to load topics"));
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const handleExtract = async () => {
    if (!canExtract || !meetingId || extracting) return;

    try {
      setExtracting(true);
      setError("");
      const { data } = await topicApi.extractTopicsForMeeting(meetingId);
      if (data?.success === false) {
        const message =
          data.error || data.message || "Failed to extract topics";
        setError(message);
        toast.error(message);
        return;
      }
      toast.success("Topics extracted for this meeting.");
      await fetchTopics();
    } catch (err) {
      console.error("Error extracting meeting topics:", err);
      const message = getErrorMessage(err, "Failed to extract topics");
      setError(message);
      toast.error(message);
    } finally {
      setExtracting(false);
    }
  };

  const handleTopicClick = (topic) => {
    if (onTopicClick) {
      onTopicClick(topic);
      return;
    }
    navigate("/topics");
  };

  return (
    <section
      data-testid="topic-summary"
      data-meeting-id={meetingId}
      className={CARD_CLASS}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Discussion Topics
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Topics extracted from this meeting transcript
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/topics"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Open Topic Explorer
          </Link>
          {canExtract && (
            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {extracting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {extracting ? "Extracting..." : "Extract Topics"}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <p
          role="status"
          aria-label="Loading meeting topics"
          className="text-sm text-gray-500 dark:text-gray-400 animate-pulse"
        >
          Loading topics...
        </p>
      )}

      {!loading && error && (
        <div
          data-testid="topic-summary-error"
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchTopics}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline self-start"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && topics.length === 0 && (
        <div
          data-testid="topic-summary-empty"
          className="text-center py-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700"
        >
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            No topics extracted yet
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {canExtract
              ? "Extract topics from this meeting's transcript to see them here."
              : "No topics have been extracted for this meeting."}
          </p>
        </div>
      )}

      {!loading && !error && topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic, index) => (
            <button
              type="button"
              key={topic._id || index}
              className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-900 rounded-full px-3 py-1 text-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              onClick={() => handleTopicClick(topic)}
            >
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {topic.name}
              </span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  topic.confidence >= 80
                    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                    : topic.confidence >= 50
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                }`}
              >
                {topic.confidence != null ? `${topic.confidence}%` : "N/A"}
              </span>
              {topic.timeRanges && topic.timeRanges.length > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 flex gap-1">
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
      )}
    </section>
  );
};

export default TopicSummary;
