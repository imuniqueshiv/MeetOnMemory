import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { meetingApi } from "../services";
import Navbar from "../components/Navbar.jsx";
import MeetingHeader from "../components/meeting-details/MeetingHeader";
import MeetingSummary from "../components/meeting-details/MeetingSummary";
import MeetingCollaborativeNotes from "../components/meeting-details/MeetingCollaborativeNotes";
import MeetingTranscript from "../components/meeting-details/MeetingTranscript";
import MeetingParticipants from "../components/meeting-details/MeetingParticipants";
import MeetingAgenda from "../components/meeting-details/MeetingAgenda";
import MeetingMetadata from "../components/meeting-details/MeetingMetadata";
import MeetingActions from "../components/meeting-details/MeetingActions";
import TranscriptAnnotations from "../components/meeting-details/TranscriptAnnotations";
import RsvpPanel from "../components/meeting-details/RsvpPanel";
import KeyMomentsPanel from "../components/meetings/KeyMomentsPanel";
import SentimentTimeline from "../components/meetings/SentimentTimeline";
import MeetingGoalsPanel from "../components/meetings/MeetingGoalsPanel";
import ShareModal from "../components/shared-links/ShareModal";
import MeetingFollowUpBanner from "../components/meeting-details/MeetingFollowUpBanner";
import PresentMode from "../components/meeting-details/PresentMode";
import PrepChecklist from "../components/meetings/PrepChecklist";
import SpeakingTimeBreakdown from "../components/meetings/SpeakingTimeBreakdown";
import CarryForwardConfig from "../components/meetings/CarryForwardConfig";
import DuplicateDetectionPanel from "../components/meeting-details/DuplicateDetectionPanel";
import MeetingTimeline from "../components/meeting-details/MeetingTimeline";
import RecapStoryViewer from "../components/summaries/RecapStoryViewer";
import { useUser } from "@clerk/clerk-react";
import BriefingBanner from "../components/meeting-details/BriefingBanner";
import { getBriefing } from "../services/briefingApi";

const MeetingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useUser();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isPresentModeOpen, setIsPresentModeOpen] = useState(false);
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState(false);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [briefingStatus, setBriefingStatus] = useState("none");

  useEffect(() => {
    const fetchMeetingDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await meetingApi.getMeetingById(id);
        if (data.success) {
          setMeeting(data.meeting);
        } else {
          setError(data.message || "Failed to fetch meeting details");
        }

        // Fetch briefing status
        try {
          const bData = await getBriefing(id);
          if (bData && bData.status) {
            setBriefingStatus(bData.status);
          }
        } catch (_bErr) {
          // ignore briefing fetch error
        }
      } catch (err) {
        console.error("Error fetching meeting details:", err);
        setError(
          err.response?.data?.message || "Failed to fetch meeting details",
        );
        toast.error("Failed to load meeting details");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchMeetingDetails();
    }
  }, [id]);

  const handleUpdateNotes = async (newNotes) => {
    try {
      const { data } = await meetingApi.updateMeetingNotes(id, newNotes);
      if (data.success) {
        toast.success("Notes updated successfully");
        setMeeting({ ...meeting, notes: newNotes });
      } else {
        toast.error(data.message || "Failed to update notes");
      }
    } catch (err) {
      console.error("Error updating notes:", err);
      toast.error(err.response?.data?.message || "Failed to update notes");
    }
  };

  const handleUpdateSummary = async (newSummary) => {
    try {
      const { data } = await meetingApi.updateMeetingSummary(id, newSummary);
      if (data.success) {
        toast.success("Summary updated successfully");
        setMeeting({ ...meeting, summary: newSummary });
      } else {
        toast.error(data.message || "Failed to update summary");
      }
    } catch (err) {
      console.error("Error updating summary:", err);
      toast.error(err.response?.data?.message || "Failed to update summary");
    }
  };

  const handleRename = async (newTitle) => {
    try {
      const { data } = await meetingApi.updateMeeting(id, { title: newTitle });
      if (data.success) {
        toast.success("Meeting renamed successfully");
        setMeeting({ ...meeting, title: newTitle });
      } else {
        toast.error(data.message || "Failed to rename meeting");
      }
    } catch (err) {
      console.error("Error renaming meeting:", err);
      toast.error(err.response?.data?.message || "Failed to rename meeting");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="max-w-6xl mx-auto p-6 pt-24">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="max-w-6xl mx-auto p-6 pt-24">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-red-500 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Error Loading Meeting
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
              <button
                onClick={() => navigate("/summaries")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Back to Meetings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="max-w-6xl mx-auto p-6 pt-24">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Meeting Not Found
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The meeting you're looking for doesn't exist.
              </p>
              <button
                onClick={() => navigate("/summaries")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Back to Meetings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setIsStoryViewerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium shadow-sm hover:opacity-90 transition-opacity"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Watch Recap Story</span>
          </button>
        </div>

        {/* Duplicate Detection Warning Panel */}
        <div className="mb-6">
          <DuplicateDetectionPanel meetingId={id} />
        </div>

        {/* Executive Briefing Banner */}
        <div className="mb-6">
          <BriefingBanner
            meetingId={id}
            initialStatus={briefingStatus}
            onBriefingReady={() => setBriefingStatus("ready")}
          />
        </div>

        {/* Smart Follow-Up Banner */}
        <div className="mb-6">
          <MeetingFollowUpBanner
            meetingId={id}
            structuredMoM={meeting.structuredMoM}
          />
        </div>

        {/* Meeting Header with Quick Actions */}
        <MeetingHeader
          meeting={meeting}
          onRename={handleRename}
          onShare={() => setShareModalOpen(true)}
          onPresent={() => setIsPresentModeOpen(true)}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Left Column - 2 cols on large screens */}
          <div className="lg:col-span-2 space-y-6">
            {/* Structured Summary */}
            <MeetingSummary
              summary={meeting.summary}
              structuredMoM={meeting.structuredMoM}
              onUpdateSummary={handleUpdateSummary}
            />

            {/* Preparation Checklist */}
            <PrepChecklist meetingId={id} />

            {/* Key Moments */}
            <KeyMomentsPanel meetingId={id} />

            {/* Meeting Goals */}
            <MeetingGoalsPanel meetingId={id} />

            {/* Meeting Timeline */}
            <MeetingTimeline
              meeting={meeting}
              onTimeSelect={(seconds) => {
                const el = document.getElementById("meeting-transcript");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth" });
                }
              }}
            />

            {/* Live/Post-Meeting Collaborative Notes */}
            <MeetingCollaborativeNotes
              meetingId={id}
              initialNotes={meeting.notes}
              onUpdateNotes={handleUpdateNotes}
            />

            {/* Full Transcript */}
            <MeetingTranscript
              meetingId={id}
              transcript={meeting.transcript}
              language={meeting.language}
            />

            {/* In-Meeting Live Annotations */}
            <TranscriptAnnotations
              meetingId={id}
              currentUser={currentUser}
              userRole={currentUser?.publicMetadata?.role || "member"}
            />
          </div>

          {/* Right Column - 1 col on large screens */}
          <div className="space-y-6">
            {/* Metadata Card */}
            <MeetingMetadata meeting={meeting} />

            {/* Quick Actions Panel */}
            <MeetingActions meeting={meeting} />

            {/* Participants Panel */}
            <MeetingParticipants
              participants={meeting.participants}
              meetingId={id}
            />

            {/* Agenda Topics */}
            <MeetingAgenda
              agenda={meeting.agenda}
              meetingId={id}
              meetingStatus={meeting.status}
            />

            {/* RSVP Tracking Panel */}
            <RsvpPanel
              meetingId={id}
              meetingDate={meeting.date}
              startTime={meeting.time}
            />

            {/* Carry-Forward Config */}
            <CarryForwardConfig
              meetingSeriesId={meeting.meetingSeriesId || meeting._id}
            />

            {/* Analytics Accordion / Container */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setIsAnalyticsExpanded(!isAnalyticsExpanded)}
                className="w-full flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                    Advanced Meeting Analytics
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-500 transform transition-transform ${isAnalyticsExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isAnalyticsExpanded && (
                <div className="p-4 space-y-6 border-t border-gray-100 dark:border-gray-700">
                  <SentimentTimeline meetingId={id} />
                  <SpeakingTimeBreakdown meetingId={id} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Share Modal */}
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          resourceId={id}
          resourceType="Meeting"
        />

        {/* Present Mode Modal */}
        {isPresentModeOpen && (
          <PresentMode
            meeting={meeting}
            onClose={() => setIsPresentModeOpen(false)}
          />
        )}

        {/* Recap Story Viewer */}
        <RecapStoryViewer
          isOpen={isStoryViewerOpen}
          onClose={() => setIsStoryViewerOpen(false)}
          meeting={meeting}
        />
      </div>
    </div>
  );
};

export default MeetingDetails;
