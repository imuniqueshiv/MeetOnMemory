import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Clock, CheckCircle, FileText, Calendar, Loader } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import apiClient from "../services/apiClient";
import AsyncSubmissionModal from "../components/meetings/AsyncSubmissionModal";

const AsyncMeetingsDashboard = () => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/async-meetings");
      setMeetings(res.data);
    } catch (err) {
      console.error("Error fetching async meetings:", err);
    } finally {
      setLoading(false);
    }
  };

  const pendingMeetings = meetings.filter((m) => m.status === "pending");
  const completedMeetings = meetings.filter(
    (m) => m.status === "completed" || m.status === "locked",
  );

  const handleOpenSubmit = (meeting) => {
    setSelectedMeeting(meeting);
    setIsSubmitModalOpen(true);
  };

  const handleSubmitted = () => {
    fetchMeetings();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      <Navbar />
      <div className="flex-grow pt-28 pb-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Async Meetings</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage and respond to asynchronous meeting requests.
            </p>
          </div>

          <div className="flex space-x-4 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              className={`pb-3 px-4 font-semibold text-sm ${
                activeTab === "pending"
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
              onClick={() => setActiveTab("pending")}
            >
              Pending Updates ({pendingMeetings.length})
            </button>
            <button
              className={`pb-3 px-4 font-semibold text-sm ${
                activeTab === "completed"
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
              onClick={() => setActiveTab("completed")}
            >
              Completed Summaries
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="grid gap-4">
              {activeTab === "pending" && (
                <>
                  {pendingMeetings.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500">
                      You have no pending async meetings to update.
                    </div>
                  ) : (
                    pendingMeetings.map((meeting) => (
                      <div
                        key={meeting._id}
                        className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md"
                      >
                        <div>
                          <h3 className="text-lg font-bold">{meeting.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Requested by{" "}
                              {meeting.creator?.name || "Organizer"}
                            </span>
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                              <Clock className="w-4 h-4" />
                              Due: {new Date(meeting.deadline).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenSubmit(meeting)}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
                        >
                          Submit Update
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === "completed" && (
                <>
                  {completedMeetings.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500">
                      No completed async meetings found.
                    </div>
                  ) : (
                    completedMeetings.map((meeting) => (
                      <div
                        key={meeting._id}
                        className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-bold">
                              {meeting.title}
                            </h3>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Completed on{" "}
                              {new Date(meeting.deadline).toLocaleDateString()}
                            </div>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Summary Ready
                          </span>
                        </div>

                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                            <FileText className="w-4 h-4" /> AI Summary
                          </h4>
                          <div className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {meeting.aiSummary
                              ? meeting.aiSummary
                              : "Summary is being generated..."}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <AsyncSubmissionModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        meeting={selectedMeeting}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
};

export default AsyncMeetingsDashboard;
