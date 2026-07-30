import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { meetingSeriesApi } from "../../services";

const SeriesNavigation = ({ meeting }) => {
  const navigate = useNavigate();
  const [series, setSeries] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meeting?.series) return;

    const fetchSeriesData = async () => {
      try {
        setLoading(true);
        const [seriesRes, meetingsRes] = await Promise.all([
          meetingSeriesApi.getSeriesById(meeting.series),
          // Fetch up to 100 meetings to allow client-side navigation
          meetingSeriesApi.getSeriesMeetings(meeting.series, 1, 100),
        ]);

        if (seriesRes.data?.success) {
          setSeries(seriesRes.data.series);
        }
        if (meetingsRes.data?.success) {
          setMeetings(meetingsRes.data.meetings);
        }
      } catch (error) {
        console.error("Failed to fetch series data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSeriesData();
  }, [meeting?.series]);

  if (!meeting?.series) return null;
  if (loading) {
    return (
      <div className="mb-6 p-4 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse h-16"></div>
    );
  }
  if (!series || meetings.length === 0) return null;

  const currentIndex = meetings.findIndex((m) => m._id === meeting._id);
  const prevMeeting = currentIndex > 0 ? meetings[currentIndex - 1] : null;
  const nextMeeting =
    currentIndex !== -1 && currentIndex < meetings.length - 1
      ? meetings[currentIndex + 1]
      : null;

  return (
    <div className="mb-6 flex items-center justify-between p-4 rounded-xl bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800">
      <div className="flex items-center gap-3 text-blue-900 dark:text-blue-100">
        <svg
          className="w-5 h-5 text-blue-600 dark:text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <div>
          <h4 className="font-semibold">{series.title} (Recurring Series)</h4>
          <p className="text-sm opacity-80">
            Meeting {meeting.seriesOccurrence} of {meetings.length}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/meeting/${prevMeeting._id}`)}
          disabled={!prevMeeting}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Previous
        </button>
        <button
          onClick={() => navigate(`/meeting/${nextMeeting._id}`)}
          disabled={!nextMeeting}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
        >
          Next
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default SeriesNavigation;
