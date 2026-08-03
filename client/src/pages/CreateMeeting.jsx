import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { meetingApi } from "../services";
import MeetingTabs from "./CreateMeeting/components/MeetingTabs";
import ScheduleMeeting from "./CreateMeeting/components/ScheduleMeeting/ScheduleMeeting";
import LiveMeeting from "./CreateMeeting/components/LiveMeeting/LiveMeeting";
import SessionCards from "./CreateMeeting/components/SessionCards/SessionCards";

import { useScheduleMeeting } from "./CreateMeeting/hooks/useScheduleMeeting";
import { useLiveMeeting } from "./CreateMeeting/hooks/useLiveMeeting";
import { useSessionCards } from "./CreateMeeting/hooks/useSessionCards";

const CreateMeeting = () => {
  const [activeSection, setActiveSection] = useState("live");
  const [searchParams] = useSearchParams();
  const duplicateFrom = searchParams.get("duplicateFrom");
  const [loadingDuplicate, setLoadingDuplicate] = useState(false);

  const scheduleMeetingHooks = useScheduleMeeting();
  const { hydrateDuplicateMeeting } = scheduleMeetingHooks;
  const liveMeetingHooks = useLiveMeeting();
  const sessionCardsHooks = useSessionCards();

  useEffect(() => {
    if (!duplicateFrom) return;

    let cancelled = false;
    setActiveSection("schedule");
    setLoadingDuplicate(true);

    meetingApi
      .getDuplicateMeetingData(duplicateFrom)
      .then(({ data }) => {
        if (cancelled) return;
        if (!data?.success || !data?.duplicateData) {
          throw new Error(data?.message || "Unable to load meeting details");
        }
        hydrateDuplicateMeeting(data.duplicateData);
        toast.success("Meeting details copied. Choose a new date and time.");
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(
          error.response?.data?.message ||
            error.message ||
            "Unable to duplicate this meeting",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingDuplicate(false);
      });

    return () => {
      cancelled = true;
    };
  }, [duplicateFrom, hydrateDuplicateMeeting]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-slate-800 dark:text-slate-200">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            📝 Meeting & Event Hub
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Schedule meetings with calendar integration, start live meetings
            with AI transcription, or create session cards for conferences.
          </p>
        </div>

        {/* Section Tabs */}
        <MeetingTabs
          activeSection={activeSection}
          setActiveSection={setActiveSection}
        />

        {/* ========== SECTION 1: SCHEDULE MEETINGS ========== */}
        {activeSection === "schedule" && (
          <ScheduleMeeting
            hookProps={scheduleMeetingHooks}
            loadingDuplicate={loadingDuplicate}
          />
        )}

        {/* ========== SECTION 2: LIVE MEETING ========== */}
        {activeSection === "live" && (
          <LiveMeeting hookProps={liveMeetingHooks} />
        )}

        {/* ========== SECTION 3: SESSION CARDS ========== */}
        {activeSection === "session" && (
          <SessionCards hookProps={sessionCardsHooks} />
        )}
      </div>
    </div>
  );
};

export default CreateMeeting;
