import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { meetingApi } from "../services";
import MeetingHeader from "../components/meeting-details/MeetingHeader";
import MeetingSummary from "../components/meeting-details/MeetingSummary";
import MeetingCollaborativeNotes from "../components/meeting-details/MeetingCollaborativeNotes";
import MeetingTranscript from "../components/meeting-details/MeetingTranscript";
import MeetingParticipants from "../components/meeting-details/MeetingParticipants";
import MeetingMetadata from "../components/meeting-details/MeetingMetadata";
import MeetingActions from "../components/meeting-details/MeetingActions";
import ShareModal from "../components/shared-links/ShareModal";
import MeetingFollowUpBanner from "../components/meeting-details/MeetingFollowUpBanner";

const MeetingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

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

  const handleDelete = async (meetingId) => {
    try {
      const { data } = await meetingApi.deleteMeeting(meetingId);
      if (data.success) {
        toast.success("Meeting deleted successfully");
        navigate("/summaries");
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <MeetingFollowUpBanner meeting={meeting} />
        <MeetingHeader
          meeting={meeting}
          onShare={() => setShareModalOpen(true)}
        />
        <MeetingSummary meeting={meeting} />
        <MeetingCollaborativeNotes meeting={meeting} />
        <MeetingTranscript meeting={meeting} />
        <MeetingParticipants meeting={meeting} />
        <MeetingMetadata meeting={meeting} />
        <MeetingActions
          meeting={meeting}
          onDelete={handleDelete}
          onRename={handleRename}
        />
      </div>

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        resourceId={meeting._id}
        resourceType="Meeting"
        title={meeting.title}
      />
    </div>
  );
};

export default MeetingDetails;
