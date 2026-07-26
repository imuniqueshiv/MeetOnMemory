import React, { useEffect, useState, useCallback, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FileText,
  Search,
  Download,
  ArrowLeft,
  Clock,
  Users,
  Calendar,
  X,
  Sparkles,
  Edit2,
  Check,
} from "lucide-react";
import { toast } from "react-toastify";
import MeetingSentimentChart from "../components/MeetingSentimentChart";
import AppContent from "../context/AppContent.js";

const TranscriptViewer = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [highlightedSegment, setHighlightedSegment] = useState(null);

  const { userData } = useContext(AppContent);
  const [editingSpeakerIndex, setEditingSpeakerIndex] = useState(null);
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [isBulkUpdate, setIsBulkUpdate] = useState(true);

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const fetchTranscript = useCallback(async () => {
    try {
      setLoading(true);
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      const response = await axios.get(
        `${backendUrl}/api/transcripts/meeting/${meetingId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        },
      );

      setTranscript(response.data);
    } catch (error) {
      console.error("Error fetching transcript:", error);
      toast.error("Failed to load transcript");
    } finally {
      setLoading(false);
    }
  }, [meetingId, backendUrl]);

  useEffect(() => {
    fetchTranscript();
  }, [fetchTranscript]);

  const handleSpeakerChange = async (index, oldSpeaker) => {
    if (!newSpeakerName.trim()) return;

    try {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      const response = await axios.put(
        `${backendUrl}/api/transcripts/${transcript._id}/speakers`,
        {
          oldSpeaker,
          newSpeaker: newSpeakerName.trim(),
          segmentIndex: isBulkUpdate ? null : index,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        },
      );

      if (response.data.success) {
        toast.success("Speaker updated successfully");
        setTranscript(
          response.data.data || response.data.transcript || response.data,
        );
        // Refresh transcript fully to ensure UI sync
        fetchTranscript();
      }
    } catch (error) {
      console.error("Error updating speaker:", error);
      toast.error(error.response?.data?.message || "Failed to update speaker");
    } finally {
      setEditingSpeakerIndex(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      const response = await axios.post(
        `${backendUrl}/api/transcripts/meeting/${meetingId}/search`,
        { query: searchQuery },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        },
      );

      setSearchResults(response.data.matches || []);
    } catch (error) {
      console.error("Error searching transcript:", error);
      toast.error("Search failed");
    }
  };

  const handleExportText = async () => {
    try {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      const response = await axios.get(
        `${backendUrl}/api/transcripts/meeting/${meetingId}/export/text`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
          responseType: "blob",
        },
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `transcript-${meetingId}.txt`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Transcript exported as text");
    } catch (error) {
      console.error("Error exporting transcript:", error);
      toast.error("Export failed");
    }
  };

  const handleExportPDF = async () => {
    try {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      const response = await axios.get(
        `${backendUrl}/api/transcripts/meeting/${meetingId}/export/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
          responseType: "blob",
        },
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `transcript-${meetingId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Transcript exported as PDF");
    } catch (error) {
      console.error("Error exporting transcript:", error);
      toast.error("Export failed");
    }
  };

  const formatTimestamp = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const highlightText = (text, query) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, "gi");
    return text.replace(
      regex,
      '<mark class="bg-yellow-300 text-black">$1</mark>',
    );
  };

  const scrollToSegment = (index) => {
    setHighlightedSegment(index);
    const element = document.getElementById(`segment-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightedSegment(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading transcript...
          </p>
        </div>
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <FileText size={64} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            Transcript Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No transcript available for this meeting
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const meeting = transcript.meeting;

  const canEdit =
    userData &&
    meeting &&
    (userData.role === "admin" ||
      userData.role === "owner" ||
      (meeting.uploadedBy && meeting.uploadedBy === userData._id) ||
      (meeting.uploadedBy && meeting.uploadedBy._id === userData._id));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ArrowLeft
                  size={20}
                  className="text-gray-600 dark:text-gray-400"
                />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {meeting?.title || "Meeting Transcript"}
                </h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {meeting?.date
                      ? new Date(meeting.date).toLocaleDateString()
                      : "N/A"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {Math.floor(transcript.duration / 60)}:
                    {Math.floor(transcript.duration % 60)
                      .toString()
                      .padStart(2, "0")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {transcript.segments?.length || 0} segments
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportText}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                title="Export as text"
              >
                <Download size={16} />
                <span className="hidden sm:inline">TXT</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                title="Export as PDF"
              >
                <Download size={16} />
                <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search transcript..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="w-full pl-10 pr-10 py-2 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transcript Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Sentiment Chart */}
            <MeetingSentimentChart transcript={transcript} />

            {transcript.segments?.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg p-8 text-center">
                <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No transcript segments available
                </p>
              </div>
            ) : (
              transcript.segments.map((segment, index) => (
                <div
                  key={index}
                  id={`segment-${index}`}
                  className={`bg-white dark:bg-slate-800 rounded-lg p-4 border ${
                    highlightedSegment === index
                      ? "border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800"
                      : "border-gray-200 dark:border-gray-700"
                  } transition-all`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {editingSpeakerIndex === index ? (
                        <div className="flex items-center gap-2 relative">
                          <input
                            type="text"
                            className="px-2 py-1 bg-white dark:bg-slate-700 border border-indigo-300 rounded text-xs text-gray-800 dark:text-gray-200"
                            value={newSpeakerName}
                            onChange={(e) => setNewSpeakerName(e.target.value)}
                            list="participants-list"
                            autoFocus
                          />
                          <datalist id="participants-list">
                            {meeting?.participants?.map((p, i) => (
                              <option key={i} value={p.name} />
                            ))}
                          </datalist>
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isBulkUpdate}
                                onChange={(e) =>
                                  setIsBulkUpdate(e.target.checked)
                                }
                                className="rounded text-indigo-600"
                              />
                              Update all '{segment.speaker}'
                            </label>
                          </div>
                          <button
                            onClick={() =>
                              handleSpeakerChange(index, segment.speaker)
                            }
                            className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingSpeakerIndex(null)}
                            className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <span
                          onClick={() => {
                            if (canEdit) {
                              setEditingSpeakerIndex(index);
                              setNewSpeakerName(segment.speaker);
                              setIsBulkUpdate(true);
                            }
                          }}
                          className={`px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded ${canEdit ? "cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors" : ""}`}
                          title={canEdit ? "Click to edit speaker" : ""}
                        >
                          {segment.speaker || "Speaker"}
                          {canEdit && (
                            <Edit2
                              size={10}
                              className="inline ml-1 opacity-50"
                            />
                          )}
                        </span>
                      )}
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {formatTimestamp(segment.startTime)}
                      </span>
                    </div>
                  </div>
                  <p
                    className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: highlightText(segment.text, searchQuery),
                    }}
                  />
                </div>
              ))
            )}
          </div>

          {/* Search Results Sidebar */}
          {searchResults.length > 0 && (
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 sticky top-40">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles size={18} className="text-indigo-600" />
                    Search Results
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {searchResults.length} matches
                  </span>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <button
                      key={index}
                      onClick={() =>
                        scrollToSegment(transcript.segments.indexOf(result))
                      }
                      className="w-full text-left p-3 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          {result.speaker || "Speaker"}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTimestamp(result.startTime)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                        {result.text}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptViewer;
