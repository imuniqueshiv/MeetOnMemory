import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { meetingApi, sessionCardApi } from "../services";
import MeetingTabs from "./CreateMeeting/components/MeetingTabs";
import ScheduleMeeting from "./CreateMeeting/components/ScheduleMeeting/ScheduleMeeting";
import LiveMeeting from "./CreateMeeting/components/LiveMeeting/LiveMeeting";
import SessionCards from "./CreateMeeting/components/SessionCards/SessionCards";
import SchedulerWizard from "../components/scheduler/SchedulerWizard.jsx";

import { useScheduleMeeting } from "./CreateMeeting/hooks/useScheduleMeeting";
import { useLiveMeeting } from "./CreateMeeting/hooks/useLiveMeeting";
import { useSessionCards } from "./CreateMeeting/hooks/useSessionCards";

const CreateMeeting = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeSection, setActiveSection] = useState(
    tabParam === "session"
      ? "session"
      : tabParam === "schedule"
        ? "schedule"
        : "live",
  );
  const duplicateFrom = searchParams.get("duplicateFrom");
  const fromSessionCard = searchParams.get("fromSessionCard");
  const [loadingDuplicate, setLoadingDuplicate] = useState(false);
  const [showSmartScheduler, setShowSmartScheduler] = useState(false);

  const scheduleMeetingHooks = useScheduleMeeting();
  const { hydrateDuplicateMeeting } = scheduleMeetingHooks;
  const liveMeetingHooks = useLiveMeeting();
  const sessionCardsHooks = useSessionCards();

  useEffect(() => {
    if (
      tabParam &&
      ["live", "schedule", "smart", "session"].includes(tabParam)
    ) {
      setActiveSection(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (activeSection === "smart") {
      setShowSmartScheduler(true);
    }
  }, [activeSection]);

  // Handle populating schedule form from a session card
  useEffect(() => {
    if (!fromSessionCard) return;

    let cancelled = false;
    setActiveSection("schedule");
    setLoadingDuplicate(true);

    sessionCardApi
      .getSessionCardById(fromSessionCard)
      .then(({ data }) => {
        if (cancelled) return;
        const session = data?.data?.session || data?.session;
        if (!session) {
          throw new Error("Unable to load session card details");
        }

        const draftPayload = {
          title: session.sessionTitle || "",
          description:
            session.summary ||
            (session.speaker ? `Speaker: ${session.speaker}` : ""),
          tags: Array.isArray(session.keywords) ? session.keywords : [],
          location: session.eventName || "Conference Session",
          venue: session.eventName || "",
        };

        hydrateDuplicateMeeting(draftPayload);
        toast.success("✨ Session card loaded into meeting draft!");
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(
          err.response?.data?.message ||
            err.message ||
            "Failed to load session card draft",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingDuplicate(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fromSessionCard, hydrateDuplicateMeeting]);

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
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Meeting & Event Hub
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Schedule meetings with calendar integration, find optimal times with
            Smart Scheduler, start live meetings with AI transcription, or
            create session cards for conferences.
          </p>
        </div>

        <MeetingTabs
          activeSection={activeSection}
          setActiveSection={setActiveSection}
        />

        {activeSection === "schedule" && (
          <ScheduleMeeting
            hookProps={scheduleMeetingHooks}
            loadingDuplicate={loadingDuplicate}
          />
        )}

        {activeSection === "smart" && !showSmartScheduler && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-slate-900">
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              Find optimal meeting times from calendars and confirm a slot.
            </p>
            <button
              type="button"
              onClick={() => setShowSmartScheduler(true)}
              className="rounded-lg bg-teal-600 px-6 py-3 font-semibold text-white hover:bg-teal-700"
            >
              Open Smart Scheduler
            </button>
          </div>
        )}

        {showSmartScheduler && (
          <SchedulerWizard
            onClose={() => {
              setShowSmartScheduler(false);
              setActiveSection("schedule");
            }}
            onScheduled={() => {
              toast.success("Meeting scheduled successfully");
              navigate("/meetings");
            }}
            onHandoff={(handoffData) => {
              if (handoffData) {
                hydrateDuplicateMeeting({
                  title: handoffData.title,
                  duration: handoffData.duration,
                  date: handoffData.date,
                  time: handoffData.time,
                  participants: handoffData.participants,
                });
                toast.success(
                  "Time slot and participants transferred to meeting form.",
                );
              }
              setShowSmartScheduler(false);
              setActiveSection("schedule");
            }}
          />
        )}

        {activeSection === "live" && (
          <LiveMeeting hookProps={liveMeetingHooks} />
        )}

        {activeSection === "session" && (
          <SessionCards hookProps={sessionCardsHooks} />
        )}
      </div>
    </div>
  );
};

export default CreateMeeting;
