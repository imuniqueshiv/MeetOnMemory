import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AppContent from "../context/AppContent";
import { meetingApi } from "../services";
import MeetingHeader from "../components/meeting-details/MeetingHeader";
import SeriesNavigation from "../components/meeting-details/SeriesNavigation";
import MeetingSummary from "../components/meeting-details/MeetingSummary";
import MinutesApproval from "../components/meetings/MinutesApproval";
import MeetingCollaborativeNotes from "../components/meeting-details/MeetingCollaborativeNotes";
import PersonalNotes from "../components/meeting-details/PersonalNotes";
import MeetingTranscript from "../components/meeting-details/MeetingTranscript";
import SpeakerAttribution from "../components/meeting-details/SpeakerAttribution";
import MeetingParticipants from "../components/meeting-details/MeetingParticipants";
import MeetingAgenda from "../components/meeting-details/MeetingAgenda";
import MeetingMetadata from "../components/meeting-details/MeetingMetadata";
import MeetingActions from "../components/meeting-details/MeetingActions";
import TranscriptAnnotations from "../components/meeting-details/TranscriptAnnotations";
import RsvpPanel from "../components/meeting-details/RsvpPanel";
import KeyMomentsPanel from "../components/meetings/KeyMomentsPanel";
import HighlightReel from "../components/meetings/HighlightReel";
import SentimentTimeline from "../components/meetings/SentimentTimeline";
import MeetingGoalsPanel from "../components/meetings/MeetingGoalsPanel";
import ShareModal from "../components/shared-links/ShareModal";
import MeetingFollowUpBanner from "../components/meeting-details/MeetingFollowUpBanner";
import PresentMode from "../components/meeting-details/PresentMode";
import PrepChecklist from "../components/meetings/PrepChecklist";
import SpeakingTimeBreakdown from "../components/meetings/SpeakingTimeBreakdown";
import CarryForwardConfig from "../components/meetings/CarryForwardConfig";
import RoleRotationConfig from "../components/meetings/RoleRotationConfig";
import DuplicateDetectionPanel from "../components/meeting-details/DuplicateDetectionPanel";
import MeetingTimeline from "../components/meeting-details/MeetingTimeline";
import RecapStoryViewer from "../components/summaries/RecapStoryViewer";
import ReactionSummaryCard from "../components/meeting-details/ReactionSummaryCard";
import { useUser } from "@clerk/clerk-react";
import Navbar from "../components/Navbar.jsx";
import BriefingBanner from "../components/meeting-details/BriefingBanner";
import CompareButton from "../components/meeting-details/CompareButton";
import AgendaBuilder from "../components/meetings/AgendaBuilder";
import IcebreakerSection from "../components/meetings/IcebreakerSection";
import { getBriefing } from "../services/briefingApi";
import GuestAccessManager from "../components/meetings/GuestAccessManager";
import MeetingReadiness from "../components/MeetingReadiness";
import FollowUpThreads from "../components/meeting-details/FollowUpThreads";
import CommentSection from "../components/meeting-details/CommentSection";
import PollSection from "../components/meeting-details/PollSection";
import FeedbackForm from "../components/meeting-details/FeedbackForm";
import AgendaTimer from "../components/meeting-details/AgendaTimer";
import AgendaPacingReport from "../components/meeting-details/AgendaPacingReport";
import ClipManager from "../components/meeting-details/ClipManager";
import TopicSummary from "../components/meeting-details/TopicSummary";
import AttachmentPanel from "../components/meeting-details/AttachmentPanel";
import DigestActions from "../components/meeting-details/DigestActions";
import HealthScoreCard from "../components/meeting-details/HealthScoreCard";
import { isMeetingEnded } from "../utils/meetingLifecycle";
import { canManageMeetingDigest } from "../utils/digestAccess";
import MeetingRisksPanel from "../components/meetings/MeetingRisksPanel";
import { useTranslation } from "react-i18next";
import { Award, ShieldAlert, FileText, Star } from "lucide-react";
import ExportDialog from "../components/export/ExportDialog";
import RetentionQuizSection from "../components/meetings/RetentionQuizSection";
import ResourceConflictsPanel from "../components/meeting-details/ResourceConflictsPanel";
import SkillEndorsementModal from "../components/meetings/SkillEndorsementModal";
import DebriefQAPanel from "../components/meetings/DebriefQAPanel";
import DelegationPanel from "../components/meetings/DelegationPanel";
import MeetingNudgesTab from "../components/meeting-details/MeetingNudgesTab.jsx";
import ConvertToAsyncModal from "../components/meetings/ConvertToAsyncModal";
import ParticipantContributions from "../components/MeetingDetails/ParticipantContributions";
import ContributionSummaryPanel from "../components/MeetingDetails/ContributionSummaryPanel";
import MeetingCostCard from "../components/meeting-details/MeetingCostCard";
import AbsenteeBriefingCard from "../components/meeting-details/AbsenteeBriefingCard";
import PrintMomModal from "../components/meetings/PrintMomModal.jsx";
import { Printer } from "lucide-react";

const MeetingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user: currentUser } = useUser();
  const { userData } = useContext(AppContent) || {};
  const isViewerOrGuest =
    userData?.role === "viewer" || userData?.role === "guest";

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isPresentModeOpen, setIsPresentModeOpen] = useState(false);
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState(false);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isEndorseModalOpen, setIsEndorseModalOpen] = useState(false);
  const [isConvertToAsyncOpen, setIsConvertToAsyncOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [briefingStatus, setBriefingStatus] = useState("idle");

  const dbUserId = currentUser?.publicMetadata?.dbUserId;
  const participant = meeting?.participants?.find(
    (p) =>
      p.user?.toString() === dbUserId || p.user?._id?.toString() === dbUserId,
  );
  const userRole = participant?.role || null;
  const isOrganizer =
    userData?.role === "admin" ||
    userData?.role === "owner" ||
    userRole === "host" ||
    userRole === "organizer" ||
    (dbUserId &&
      (meeting?.uploadedBy?._id?.toString() === dbUserId ||
        meeting?.uploadedBy?.toString() === dbUserId)) ||
    (userData?._id &&
      (meeting?.uploadedBy?._id?.toString() === userData._id.toString() ||
        meeting?.uploadedBy?.toString() === userData._id.toString()));

  const handleCitationClick = (citation) => {
    if (citation.type === "transcript" && citation.timestamp !== null) {
      const event = new CustomEvent("seekToTimestamp", {
        detail: citation.timestamp,
      });
      window.dispatchEvent(event);
      const transcriptEl = document.querySelector(
        `[data-start-time="${citation.timestamp}"]`,
      );
      if (transcriptEl) {
        transcriptEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else if (citation.type === "decision") {
      const decisionEl = document.querySelector(
        `[data-decision-id="${citation.refId}"]`,
      );
      if (decisionEl) {
        decisionEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const handleGenerateBriefing = async () => {
    setBriefingStatus("generating");
    try {
      const response = await fetch(`/api/meetings/${id}/briefing-generate`, {
        method: "POST",
      });
      if (response.ok) {
        setBriefingStatus("ready");
      } else {
        setBriefingStatus("failed");
      }
    } catch (err) {
      console.error("Failed to generate briefing:", err);
      setBriefingStatus("failed");
    }
  };

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
        } catch (bErr) {
          // It's ok if it doesn't exist
          console.warn("Could not fetch briefing", bErr);
          setBriefingStatus("none");
        }
      } catch (err) {
        console.error("Error fetching meeting details:", err);
        setError(
          err.response?.data?.message || "Failed to fetch meeting details",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMeetingDetails();
  }, [id]);

  const refreshMeeting = async () => {
    try {
      const { data } = await meetingApi.getMeetingById(id);
      if (data.success) {
        setMeeting(data.meeting);
      }
    } catch (err) {
      console.error("Error refreshing meeting after speaker mapping:", err);
    }
  };

  const handleBack = () => {
    if (
      window.history.state &&
      typeof window.history.state.idx === "number" &&
      window.history.state.idx > 0
    ) {
      navigate(-1);
    } else {
      navigate("/meetings");
    }
  };

  const handleDelete = async (meetingId) => {
    try {
      const { data } = await meetingApi.deleteMeeting(meetingId);
      if (data.success) {
        toast.success(
          <div className="flex items-center justify-between gap-3">
            <span>Meeting moved to recycle bin</span>
            <button
              type="button"
              onClick={() => navigate("/meetings/recycle-bin")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline shrink-0"
            >
              View Recycle Bin
            </button>
          </div>,
        );
        toast.success("Meeting deleted successfully");
        navigate("/meetings");
      } else {
        toast.error(data.message || "Failed to delete meeting");
      }
    } catch (err) {
      console.error("Error deleting meeting:", err);
      toast.error(err.response?.data?.message || "Failed to delete meeting");
    }
  };

  const handleRename = async (meetingId, newTitle) => {
    try {
      const { data } = await meetingApi.updateMeeting(meetingId, {
        title: newTitle,
      });
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Navbar />
        <div className="flex-grow pt-28 pb-12 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Navbar />
        <div className="flex-grow pt-28 pb-12 px-6">
          <div className="max-w-6xl mx-auto">
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
                  {t("meetingDetails.errorLoading")}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
                <button
                  onClick={handleBack}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {t("meetingDetails.backToMeetings")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Navbar />
        <div className="flex-grow pt-28 pb-12 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-center py-12">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {t("meetingDetails.notFound")}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t("meetingDetails.notFoundDesc")}
                </p>
                <button
                  onClick={handleBack}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {t("meetingDetails.backToMeetings")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      <Navbar />
      <div className="flex-grow pt-28 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          {isViewerOrGuest && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-200 text-sm">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="flex-1">
                <span className="font-bold">
                  Read-Only Access ({userData?.role || "Viewer"} Mode):
                </span>{" "}
                You have view permissions for this meeting. Interactive controls
                like recording, editing notes, renaming, and member invitations
                are disabled.
              </div>
            </div>
          )}

          <div className="mb-4 flex justify-end gap-3">
            <CompareButton meetingId={meeting._id} />
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium shadow-sm transition-colors text-sm"
              title="Print formatted Minutes of Meeting"
              data-testid="print-minutes-btn"
            >
              <Printer className="w-4 h-4" />
              Print Minutes
            </button>
            <button
              onClick={() => setIsExportDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm"
              data-testid="open-export-dialog-btn"
            >
              <FileText className="w-4 h-4" />
              Export Minutes
            </button>
            <button
              onClick={() => setIsEndorseModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium shadow-sm transition-colors text-sm"
              disabled={isViewerOrGuest}
              title={
                isViewerOrGuest
                  ? "Viewers cannot endorse peers"
                  : "Recognize peers for their skills"
              }
            >
              <Star className="w-4 h-4" />
              Recognize Peers
            </button>
            {isOrganizer && (
              <button
                onClick={() => setIsConvertToAsyncOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm"
              >
                Convert to Async
              </button>
            )}
            <button
              onClick={() => setIsStoryViewerOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium shadow-sm hover:opacity-90 transition-opacity text-sm"
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
                  strokeWidth="2"
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                ></path>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              {t("meetingDetails.playRecapStory")}
            </button>
          </div>

          {meeting.date && new Date(meeting.date) > new Date() && (
            <BriefingBanner
              meetingId={meeting._id}
              briefingStatus={briefingStatus}
              onRegenerate={() => setBriefingStatus("pending")}
            />
          )}

          <DuplicateDetectionPanel meetingId={meeting._id} />
          <MeetingFollowUpBanner meeting={meeting} />
          <div className="mt-6 mb-6">
            <MeetingReadiness
              meetingId={meeting._id}
              meeting={meeting}
              briefingStatus={briefingStatus}
              currentUser={currentUser}
            />
          </div>
          <MeetingHeader
            meeting={meeting}
            onShare={() => setShareModalOpen(true)}
            onPresent={() => setIsPresentModeOpen(true)}
          />
          {(meeting.series || meeting.seriesId) && (
            <SeriesNavigation meeting={meeting} />
          )}

          <ResourceConflictsPanel meeting={meeting} />

          <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm mt-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {t("meetingDetails.aiIntelligenceCore")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t("meetingDetails.aiIntelligenceCoreDesc")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {briefingStatus === "generating" && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/40">
                    <span className="w-3 h-3 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" />
                    {t("meetingDetails.generating")}
                  </div>
                )}

                {briefingStatus === "failed" && (
                  <span className="text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/40">
                    {t("meetingDetails.generationFailed")}
                  </span>
                )}

                {briefingStatus === "ready" && (
                  <button
                    onClick={() => navigate(`/meeting/${id}/briefing`)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow transition"
                  >
                    {t("meetingDetails.openBriefing")}
                  </button>
                )}

                <button
                  onClick={() => navigate(`/meeting/${id}/quality`)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow transition"
                >
                  <Award className="w-4 h-4" />
                  {t("meetingDetails.meetingQuality")}
                </button>

                {(briefingStatus === "idle" ||
                  briefingStatus === "none" ||
                  briefingStatus === "failed") && (
                  <button
                    onClick={handleGenerateBriefing}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow transition"
                  >
                    {t("meetingDetails.generateBrief")}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mb-6">
            <ContributionSummaryPanel meetingId={meeting._id} />
          </div>
          <AbsenteeBriefingCard meetingId={meeting._id} />
          <MeetingSummary meeting={meeting} />

          <div className="mt-6 mb-6">
            <MeetingNudgesTab
              meetingId={meeting._id}
              isOrganizer={isOrganizer}
            />
          </div>

          <RetentionQuizSection
            meeting={meeting}
            isOrganizer={
              currentUser?.publicMetadata?.dbUserId === meeting.uploadedBy
            }
          />

          <div className="mt-6 mb-6">
            <MeetingCostCard meetingId={meeting._id} />
            <HealthScoreCard
              meetingId={meeting._id}
              organizationId={
                meeting.organization?._id || meeting.organization || undefined
              }
            />
          </div>
          <MinutesApproval meeting={meeting} />
          <MeetingCollaborativeNotes meeting={meeting} />

          <div className="mt-6 mb-6">
            <PersonalNotes meeting={meeting} />
          </div>

          <div className="mt-6 mb-6">
            <MeetingTimeline meetingId={meeting._id} meeting={meeting} />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mt-6 mb-6 overflow-hidden h-[500px]">
            <KeyMomentsPanel meetingId={meeting._id} />
          </div>

          <div className="mt-6 mb-6">
            <HighlightReel meetingId={meeting._id} />
          </div>

          <div className="mt-6 mb-6">
            <SpeakerAttribution
              meetingId={meeting._id}
              participants={meeting.participants}
              onMappingChange={refreshMeeting}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <MeetingTranscript meeting={meeting} />
            </div>
            <div className="xl:col-span-1 h-[600px]">
              <DebriefQAPanel
                meetingId={meeting._id}
                onCitationClick={handleCitationClick}
              />
            </div>
          </div>
          <div className="mt-6 mb-6">
            <TopicSummary
              meetingId={meeting._id}
              canExtract={!isViewerOrGuest}
            />
          </div>
          <div className="mt-6 mb-6">
            <ClipManager
              meetingId={meeting._id}
              meeting={meeting}
              canManage={!isViewerOrGuest}
            />
          </div>
          <TranscriptAnnotations meeting={meeting} />

          <div className="mt-6 mb-6">
            <FollowUpThreads meetingId={meeting._id} />
          </div>

          <div className="mt-6 mb-6">
            <CommentSection meetingId={meeting._id} />
          </div>

          <div className="mt-6 mb-6">
            <PollSection meetingId={meeting._id} title="Polls" />
          </div>

          <div className="mt-6 mb-6">
            <FeedbackForm
              meetingId={meeting._id}
              organizationId={
                meeting.organization?._id || meeting.organization || undefined
              }
            />
          </div>

          <div className="mt-6 mb-6">
            <SentimentTimeline meetingId={meeting._id} />
          </div>

          {/* Reaction Summary Card (Issue #1993) */}
          <ReactionSummaryCard meetingId={meeting._id} />

          {/* Speaking Time Analytics Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mt-6 mb-6 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2
                className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 cursor-pointer"
                onClick={() => setIsAnalyticsExpanded(!isAnalyticsExpanded)}
              >
                <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                  <svg
                    className={`w-5 h-5 transform transition-transform ${isAnalyticsExpanded ? "rotate-180" : ""}`}
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
                Speaking Time Analytics
              </h2>
              <button
                onClick={() => navigate("/speaking-time-trends")}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                View My Trends →
              </button>
            </div>
            {isAnalyticsExpanded && (
              <SpeakingTimeBreakdown meetingId={meeting._id} />
            )}
          </div>

          {/* Participant Contributions Profile */}
          <div className="mb-6">
            <ParticipantContributions meetingId={meeting._id} />
          </div>

          <MeetingParticipants meeting={meeting} />
          <RsvpPanel
            meetingId={meeting._id}
            isOrganizer={
              currentUser?.publicMetadata?.dbUserId === meeting.uploadedBy
            }
            participants={meeting.participants}
          />
          <PrepChecklist meeting={meeting} currentUser={currentUser} />
          <MeetingGoalsPanel meeting={meeting} currentUser={currentUser} />

          {meeting.series && (
            <>
              <CarryForwardConfig
                seriesId={meeting.series._id || meeting.series}
                currentMeetingId={meeting._id}
                userRole={
                  currentUser?.publicMetadata?.dbUserId === meeting.uploadedBy
                    ? "host"
                    : "member"
                }
                onApplySuccess={() => {
                  // Reload meeting data to reflect new agenda items
                  window.location.reload();
                }}
              />
              {currentUser?.publicMetadata?.dbUserId === meeting.uploadedBy && (
                <RoleRotationConfig
                  seriesId={meeting.series._id || meeting.series}
                  users={meeting.participants.map((p) => ({
                    _id: p.user,
                    name: p.name,
                    email: p.email,
                  }))}
                />
              )}
            </>
          )}

          <div className="mt-6 mb-6">
            <MeetingRisksPanel meetingId={meeting._id} />
          </div>

          <AgendaBuilder
            meetingId={meeting._id}
            isOrganizer={
              currentUser?.publicMetadata?.dbUserId === meeting.uploadedBy
            }
            userRole={userRole}
          />

          <IcebreakerSection meetingId={meeting._id} />

          <MeetingAgenda meeting={meeting} />
          <div className="mt-6 mb-6">
            <AgendaTimer meeting={meeting} readOnly />
          </div>
          {isMeetingEnded(meeting) && (
            <div className="mt-6 mb-6">
              <AgendaPacingReport meetingId={meeting._id} />
            </div>
          )}
          <MeetingMetadata meeting={meeting} />
          <div className="mt-6 mb-6">
            <AttachmentPanel
              meetingId={meeting._id}
              userRole={userData?.role}
              currentUserId={userData?._id}
            />
          </div>
          {canManageMeetingDigest({
            meeting,
            userData,
            dbUserId,
          }) && (
            <div className="mt-6 mb-6">
              <DigestActions meetingId={meeting._id} canManage />
            </div>
          )}
          {currentUser?.publicMetadata?.dbUserId === meeting.uploadedBy && (
            <GuestAccessManager meetingId={meeting._id} />
          )}
          {isOrganizer && (
            <DelegationPanel
              meetingId={meeting._id}
              participants={meeting.participants}
            />
          )}
          <MeetingActions
            meeting={meeting}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        </div>
      </div>

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        resourceId={meeting._id}
        resourceType="Meeting"
        title={meeting.title}
      />

      {isPresentModeOpen && (
        <PresentMode
          meeting={meeting}
          onClose={() => setIsPresentModeOpen(false)}
        />
      )}

      {isStoryViewerOpen && (
        <RecapStoryViewer
          meetingId={meeting._id}
          onClose={() => setIsStoryViewerOpen(false)}
        />
      )}

      {isExportDialogOpen && (
        <ExportDialog
          meetingId={meeting._id}
          onClose={() => setIsExportDialogOpen(false)}
        />
      )}

      <SkillEndorsementModal
        isOpen={isEndorseModalOpen}
        onClose={() => setIsEndorseModalOpen(false)}
        meetingId={meeting._id}
        participants={meeting.participants}
        currentUser={currentUser}
      />

      <ConvertToAsyncModal
        isOpen={isConvertToAsyncOpen}
        onClose={() => setIsConvertToAsyncOpen(false)}
        meeting={meeting}
        isSeries={false}
      />

      <PrintMomModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        meeting={meeting}
        summary={meeting.summary || meeting.structuredMoM}
      />
    </div>
  );
};

export default MeetingDetails;
