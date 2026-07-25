import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { apiClient, meetingApi } from "../../services";

const MeetingFollowUpBanner = ({ meeting }) => {
  const [intents, setIntents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (meeting?.structuredMoM?.scheduling_intents?.length > 0) {
      // Process each intent and fetch suggested slots
      const processIntents = async () => {
        const processed = await Promise.all(
          meeting.structuredMoM.scheduling_intents.map(async (intent) => {
            if (!intent.suggested_date_iso) return intent;
            try {
              const res = await apiClient.post("/api/calendar/suggest-slot", {
                targetDateIso: intent.suggested_date_iso,
                durationMinutes: 30,
              });
              if (res.data.success) {
                return {
                  ...intent,
                  final_suggested_date: res.data.suggestedSlot,
                };
              }
            } catch (err) {
              console.error("Failed to suggest slot:", err);
            }
            return {
              ...intent,
              final_suggested_date: intent.suggested_date_iso,
            };
          }),
        );
        setIntents(processed);
      };
      processIntents();
    }
  }, [meeting]);

  const handleSchedule = async (intent) => {
    if (!intent.final_suggested_date) {
      toast.error("No specific date identified for this follow-up.");
      return;
    }
    try {
      setLoading(true);
      const res = await meetingApi.scheduleMeeting({
        title: `Follow-up: ${intent.topic}`,
        description: `Follow-up meeting scheduled from: ${meeting.title}`,
        date: intent.final_suggested_date,
        time: new Date(intent.final_suggested_date).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        duration: 30,
        syncToCalendar: true,
        meetingType: meeting.meetingType || "internal",
      });
      if (res.data.success) {
        toast.success(
          `Scheduled successfully for ${new Date(intent.final_suggested_date).toLocaleString()}`,
        );
      }
    } catch (err) {
      toast.error(err.message || "Failed to schedule meeting.");
    } finally {
      setLoading(false);
    }
  };

  if (!intents.length) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 mb-6 rounded-md shadow-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-blue-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">
            AI Detected Follow-up{" "}
            {intents.length > 1 ? "Requirements" : "Requirement"}
          </h3>
          <div className="mt-2 text-sm text-blue-700 dark:text-blue-200">
            <ul className="list-disc pl-5 space-y-2">
              {intents.map((intent, idx) => (
                <li key={idx}>
                  <span>
                    {intent.topic} - Suggested for{" "}
                    {intent.final_suggested_date
                      ? new Date(intent.final_suggested_date).toLocaleString(
                          [],
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : intent.timeframe}
                  </span>
                  <button
                    onClick={() => handleSchedule(intent)}
                    disabled={loading}
                    className="ml-3 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 underline disabled:opacity-50"
                  >
                    [Click here] to schedule
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingFollowUpBanner;
