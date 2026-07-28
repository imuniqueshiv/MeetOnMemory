import React, { useState } from "react";
import Navbar from "../components/Navbar.jsx";
import MeetingTabs from "./CreateMeeting/components/MeetingTabs";
import ScheduleMeeting from "./CreateMeeting/components/ScheduleMeeting/ScheduleMeeting";
import LiveMeeting from "./CreateMeeting/components/LiveMeeting/LiveMeeting";
import SessionCards from "./CreateMeeting/components/SessionCards/SessionCards";

import { useScheduleMeeting } from "./CreateMeeting/hooks/useScheduleMeeting";
import { useLiveMeeting } from "./CreateMeeting/hooks/useLiveMeeting";
import { useSessionCards } from "./CreateMeeting/hooks/useSessionCards";

const CreateMeeting = () => {
  const [activeSection, setActiveSection] = useState("live");

  const scheduleMeetingHooks = useScheduleMeeting();
  const liveMeetingHooks = useLiveMeeting();
  const sessionCardsHooks = useSessionCards();

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
          <ScheduleMeeting hookProps={scheduleMeetingHooks} />
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
