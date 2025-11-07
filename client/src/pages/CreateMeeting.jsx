import React, { useState, useContext } from "react";
import Navbar from "../components/Navbar.jsx";
import { AppContent } from "../context/AppContext.jsx";
import axios from "axios";
import { toast } from "react-toastify";
import {
  FileText,
  Calendar,
  Users,
  MapPin,
  Clock,
  Upload,
  Mic,
  Video,
  FileAudio,
  Loader2,
  Plus,
  X,
  Shield,
  Send,
  Paperclip,
  UserPlus,
  CheckCircle,
  FileVideo,
  Presentation,
  Sparkles,
  Tag,
  ExternalLink,
  AlertCircle
} from "lucide-react";

const CreateMeeting = () => {
  const { backendUrl } = useContext(AppContent);
  const [activeSection, setActiveSection] = useState("live");
  const [loading, setLoading] = useState(false);

  // ========== SECTION 1: SCHEDULE MEETINGS ==========
  const [scheduleData, setScheduleData] = useState({
    title: "",
    description: "",
    meetingType: "conference",
    date: "",
    time: "",
    duration: "",
    location: "",
    venue: "",
  });
  const [participants, setParticipants] = useState([]);
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "" });
  const [agendaItems, setAgendaItems] = useState([]);
  const [newAgenda, setNewAgenda] = useState("");
  const [attachments, setAttachments] = useState([]);

  // ========== SECTION 2: LIVE MEETING ==========
  const [liveParticipants, setLiveParticipants] = useState([]);
  const [newLiveParticipant, setNewLiveParticipant] = useState({ name: "", email: "" });
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(null);

  // ========== SECTION 3: SESSION CARDS (CONFERENCE/SEMINAR) ==========
  const [sessionData, setSessionData] = useState({
    eventName: "",
    sessionTitle: "",
    speaker: "",
    speakerBio: "",
    speakerTitle: "",
  });
  const [slideFiles, setSlideFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [generatedSessions, setGeneratedSessions] = useState([]);

  // ========== HANDLERS: SECTION 1 - SCHEDULE ==========
  const handleScheduleChange = (e) => {
    const { name, value } = e.target;
    setScheduleData((prev) => ({ ...prev, [name]: value }));
  };

  const addParticipant = () => {
    if (newParticipant.name.trim() && newParticipant.email.trim()) {
      setParticipants([...participants, { ...newParticipant, id: Date.now() }]);
      setNewParticipant({ name: "", email: "" });
      toast.success("Participant added");
    } else {
      toast.error("Please enter both name and email");
    }
  };

  const removeParticipant = (id) => {
    setParticipants(participants.filter((p) => p.id !== id));
  };

  const addAgendaItem = () => {
    if (newAgenda.trim()) {
      setAgendaItems([...agendaItems, { text: newAgenda, id: Date.now() }]);
      setNewAgenda("");
      toast.success("Agenda item added");
    }
  };

  const removeAgendaItem = (id) => {
    setAgendaItems(agendaItems.filter((a) => a.id !== id));
  };

  const handleAttachmentUpload = (e) => {
    const files = Array.from(e.target.files);
    setAttachments([...attachments, ...files]);
    toast.success(`${files.length} file(s) attached`);
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduleData.title.trim()) {
      toast.error("Meeting title is required");
      return;
    }

    if (!scheduleData.date || !scheduleData.time) {
      toast.error("Date and time are required");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...scheduleData,
        participants,
        agendaItems,
      };

      const response = await axios.post(
        `${backendUrl}/api/meetings/schedule`,
        payload,
        { withCredentials: true }
      );

      if (response.data?.success) {
        toast.success("✅ Meeting scheduled and synced to calendars!");
        
        // Trigger calendar integration
        if (response.data.calendarLinks) {
          toast.info("📅 Calendar invites sent to all participants!");
        }

        // Reset form
        setScheduleData({
          title: "",
          description: "",
          meetingType: "conference",
          date: "",
          time: "",
          duration: "",
          location: "",
          venue: "",
        });
        setParticipants([]);
        setAgendaItems([]);
        setAttachments([]);
      } else {
        toast.error(response.data?.message || "Failed to schedule meeting");
      }
    } catch (error) {
      console.error("Error scheduling meeting:", error);
      toast.error(error.response?.data?.message || "Unable to schedule meeting");
    } finally {
      setLoading(false);
    }
  };

  // ========== HANDLERS: SECTION 2 - LIVE MEETING ==========
  const addLiveParticipant = () => {
    if (newLiveParticipant.name.trim() && newLiveParticipant.email.trim()) {
      setLiveParticipants([...liveParticipants, { ...newLiveParticipant, id: Date.now() }]);
      setNewLiveParticipant({ name: "", email: "" });
      toast.success("Participant added");
    } else {
      toast.error("Please enter both name and email");
    }
  };

  const removeLiveParticipant = (id) => {
    setLiveParticipants(liveParticipants.filter((p) => p.id !== id));
  };

  const handleStartLiveMeeting = () => {
    if (liveParticipants.length === 0) {
      toast.warning("Add at least one participant before starting the meeting");
      return;
    }
    setShowRecordingDialog(true);
  };

  const handleRecordingChoice = (willRecord) => {
    setRecordingConsent(willRecord);
    setShowRecordingDialog(false);

    const recordingStatus = willRecord ? "with recording enabled" : "without recording";
    toast.success(`🎥 Starting live meeting ${recordingStatus}...`);

    // Redirect to meeting room with parameters
    setTimeout(() => {
      window.open(
        `/meeting-room?recording=${willRecord}&participants=${encodeURIComponent(JSON.stringify(liveParticipants))}`,
        '_blank'
      );
      
      // Reset participants after redirect
      setLiveParticipants([]);
    }, 500);
  };

  // ========== HANDLERS: SECTION 3 - SESSION CARDS ==========
  const handleSessionChange = (e) => {
    const { name, value } = e.target;
    setSessionData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSlideUpload = (e) => {
    const files = Array.from(e.target.files);
    setSlideFiles([...slideFiles, ...files]);
    toast.success(`${files.length} slide file(s) uploaded`);
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      toast.success(`Video "${file.name}" selected`);
    }
  };

  const removeSlideFile = (index) => {
    setSlideFiles(slideFiles.filter((_, i) => i !== index));
  };

  const handleSessionSubmit = async (e) => {
    e.preventDefault();
    if (!sessionData.sessionTitle.trim() || slideFiles.length === 0) {
      toast.error("Session title and at least one slide file are required");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("eventName", sessionData.eventName);
      formData.append("sessionTitle", sessionData.sessionTitle);
      formData.append("speaker", sessionData.speaker);
      formData.append("speakerBio", sessionData.speakerBio);
      formData.append("speakerTitle", sessionData.speakerTitle);

      slideFiles.forEach((file) => {
        formData.append("slides", file);
      });

      if (videoFile) {
        formData.append("video", videoFile);
      }

      const response = await axios.post(
        `${backendUrl}/api/sessions/generate`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
        }
      );

      if (response.data?.success) {
        toast.success("✨ AI Session card generated successfully!");
        setGeneratedSessions([response.data.session, ...generatedSessions]);

        // Reset form
        setSessionData({
          eventName: "",
          sessionTitle: "",
          speaker: "",
          speakerBio: "",
          speakerTitle: "",
        });
        setSlideFiles([]);
        setVideoFile(null);
      } else {
        toast.error(response.data?.message || "Failed to create session");
      }
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error(error.response?.data?.message || "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            📝 Meeting & Event Hub
          </h1>
          <p className="text-gray-600 max-w-3xl mx-auto">
            Schedule meetings with calendar integration, start live meetings with AI transcription, or create session cards for conferences.
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex flex-wrap gap-3 mb-8 justify-center">
          <button
            onClick={() => setActiveSection("schedule")}
            className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${activeSection === "schedule"
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
              }`}
          >
            <Calendar size={20} /> Schedule Meeting
          </button>
          <button
            onClick={() => setActiveSection("live")}
            className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${activeSection === "live"
                ? "bg-indigo-600 text-white shadow-lg"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
              }`}
          >
            <Video size={20} /> Live Meeting
          </button>
          <button
            onClick={() => setActiveSection("session")}
            className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${activeSection === "session"
                ? "bg-purple-600 text-white shadow-lg"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
              }`}
          >
            <Presentation size={20} /> Session Cards
          </button>
        </div>

        {/* ========== SECTION 1: SCHEDULE MEETINGS ========== */}
        {activeSection === "schedule" && (
          <div className="bg-white shadow-lg rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="text-blue-600" size={28} />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Schedule Meeting</h2>
                <p className="text-sm text-gray-600">Create and manage meeting schedules with automatic calendar integration</p>
              </div>
            </div>

            <form onSubmit={handleScheduleSubmit}>
              {/* Meeting Type */}
              <div className="mb-6">
                <label className="block mb-3 font-semibold text-gray-700">Meeting Type</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {["conference", "policy", "event", "internal"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setScheduleData({ ...scheduleData, meetingType: type })}
                      className={`px-4 py-2 rounded-lg border-2 transition capitalize ${scheduleData.meetingType === type
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300"
                        }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Description */}
              <div className="mb-6">
                <label className="block mb-2 font-semibold text-gray-700">Meeting Title *</label>
                <input
                  type="text"
                  name="title"
                  value={scheduleData.title}
                  onChange={handleScheduleChange}
                  placeholder="e.g., Q4 Board Meeting, Policy Review"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block mb-2 font-semibold text-gray-700">Description & Objective</label>
                <textarea
                  name="description"
                  value={scheduleData.description}
                  onChange={handleScheduleChange}
                  placeholder="Brief overview and expected outcomes..."
                  rows="3"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                ></textarea>
              </div>

              {/* Date & Time */}
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block mb-2 font-semibold text-gray-700">Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={scheduleData.date}
                    onChange={handleScheduleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-gray-700">Time *</label>
                  <input
                    type="time"
                    name="time"
                    value={scheduleData.time}
                    onChange={handleScheduleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-gray-700">Duration (min)</label>
                  <input
                    type="number"
                    name="duration"
                    value={scheduleData.duration}
                    onChange={handleScheduleChange}
                    placeholder="60"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block mb-2 font-semibold text-gray-700">Location/Platform</label>
                  <input
                    type="text"
                    name="location"
                    value={scheduleData.location}
                    onChange={handleScheduleChange}
                    placeholder="e.g., Zoom, Conference Room A"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-gray-700">Venue Details</label>
                  <input
                    type="text"
                    name="venue"
                    value={scheduleData.venue}
                    onChange={handleScheduleChange}
                    placeholder="Address or meeting link"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                </div>
              </div>

              {/* Participants */}
              <div className="mb-6">
                <label className="block mb-3 font-semibold text-gray-700 flex items-center gap-2">
                  <Users size={18} /> Invite Participants
                </label>
                <div className="grid md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={newParticipant.name}
                    onChange={(e) => setNewParticipant({ ...newParticipant, name: e.target.value })}
                    placeholder="Full Name"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                  <input
                    type="email"
                    value={newParticipant.email}
                    onChange={(e) => setNewParticipant({ ...newParticipant, email: e.target.value })}
                    placeholder="Email Address"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={addParticipant}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <UserPlus size={16} /> Add Participant
                </button>

                {participants.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {participants.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                        <span className="text-sm">
                          <strong>{p.name}</strong> - {p.email}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeParticipant(p.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Agenda */}
              <div className="mb-6">
                <label className="block mb-3 font-semibold text-gray-700">Meeting Agenda</label>
                <div className="flex gap-3 mb-3">
                  <input
                    type="text"
                    value={newAgenda}
                    onChange={(e) => setNewAgenda(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addAgendaItem())}
                    placeholder="Add agenda item..."
                    className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={addAgendaItem}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {agendaItems.length > 0 && (
                  <ul className="space-y-2">
                    {agendaItems.map((item, index) => (
                      <li key={item.id} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                        <span className="text-sm">
                          {index + 1}. {item.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAgendaItem(item.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Attachments */}
              <div className="mb-6">
                <label className="block mb-3 font-semibold text-gray-700 flex items-center gap-2">
                  <Paperclip size={18} /> Attach Supporting Documents
                </label>
                <input
                  type="file"
                  multiple
                  onChange={handleAttachmentUpload}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400"
                />
                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                        <span className="text-sm">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Calendar Integration Notice */}
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                <div className="text-sm text-gray-700">
                  <strong>Auto Calendar Sync:</strong> This meeting will be automatically added to Google Calendar, Outlook, and participant calendars with email invites.
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Scheduling & Syncing Calendars...
                  </>
                ) : (
                  <>
                    <Send size={18} /> Schedule Meeting & Send Invites
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ========== SECTION 2: LIVE MEETING ========== */}
        {activeSection === "live" && (
          <div className="bg-white shadow-lg rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Video className="text-indigo-600" size={28} />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Start Live Meeting</h2>
                <p className="text-sm text-gray-600">Add participants and start a live meeting with optional AI transcription</p>
              </div>
            </div>

            {/* Participants */}
            <div className="mb-6">
              <label className="block mb-3 font-semibold text-gray-700 flex items-center gap-2">
                <Users size={18} /> Add Participants
              </label>
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  value={newLiveParticipant.name}
                  onChange={(e) => setNewLiveParticipant({ ...newLiveParticipant, name: e.target.value })}
                  placeholder="Full Name"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
                />
                <input
                  type="email"
                  value={newLiveParticipant.email}
                  onChange={(e) => setNewLiveParticipant({ ...newLiveParticipant, email: e.target.value })}
                  placeholder="Email Address"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={addLiveParticipant}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <UserPlus size={16} /> Add Participant
              </button>

              {liveParticipants.length > 0 && (
                <div className="mt-4 space-y-2">
                  {liveParticipants.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                      <span className="text-sm">
                        <strong>{p.name}</strong> - {p.email}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLiveParticipant(p.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Meeting Info */}
            <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-purple-50 p-6 shadow-lg mb-6">
              <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-indigo-700 flex items-center gap-2 mb-2">
                    <Video className="text-indigo-600" size={22} />
                    Live AI Meeting Connect
                  </h3>
                  <p className="text-gray-700 mb-4 leading-relaxed">
                    🔴 Experience <strong>real-time video conferencing</strong> integrated with
                    <strong> AI-powered transcription and live summarization</strong>. Your meeting notes will be generated instantly with smart highlights.
                  </p>

                  <ul className="text-sm text-gray-600 mb-4 space-y-1">
                    <li>• Automatic speech-to-text in real-time</li>
                    <li>• Live participant tracking & emotion insights</li>
                    <li>• AI auto-summary after meeting ends</li>
                  </ul>
                </div>

                <div className="flex-shrink-0">
                  <img
                    src="https://cdn.dribbble.com/users/23546/screenshots/20531077/media/0a5f35125d57a6eb88a6a0a2d3087b45.gif"
                    alt="Live meeting animation"
                    className="w-56 rounded-xl border border-indigo-100 shadow-md"
                  />
                </div>
              </div>
            </div>

            {/* Start Meeting Button */}
            <a
              href="/meeting-room"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (liveParticipants.length === 0) {
                  e.preventDefault();
                  toast.warning("Add at least one participant before starting the meeting");
                } else {
                  setShowRecordingDialog(true);
                  e.preventDefault();
                }
              }}
              className={`w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-md hover:shadow-xl ${
                liveParticipants.length === 0 ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <Video size={18} /> 🚀 Start Live Meeting
              <ExternalLink size={16} />
            </a>
          </div>
        )}

        {/* ========== SECTION 3: SESSION CARDS ========== */}
        {activeSection === "session" && (
          <div className="bg-white shadow-lg rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Presentation className="text-purple-600" size={28} />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Auto Session Card Generation</h2>
                <p className="text-sm text-gray-600">
                  Upload slides/videos from conferences and seminars - AI generates session cards with summaries, keywords, and speaker profiles
                </p>
              </div>
            </div>

            <form onSubmit={handleSessionSubmit}>
              {/* Event & Session Info */}
              <div className="mb-6">
                <label className="block mb-2 font-semibold text-gray-700">Event Name</label>
                <input
                  type="text"
                  name="eventName"
                  value={sessionData.eventName}
                  onChange={handleSessionChange}
                  placeholder="e.g., TechCon 2025, Annual Research Symposium"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
                />
              </div>

              <div className="mb-6">
                <label className="block mb-2 font-semibold text-gray-700">Session Title *</label>
                <input
                  type="text"
                  name="sessionTitle"
                  value={sessionData.sessionTitle}
                  onChange={handleSessionChange}
                  placeholder="e.g., AI in Healthcare: Future Perspectives"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
                  required
                />
              </div>

              {/* Speaker Information */}
              <div className="mb-6 p-6 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users size={20} className="text-purple-600" /> Speaker Profile
                </h3>

                <div className="mb-4">
                  <label className="block mb-2 font-medium text-gray-700">Speaker Name</label>
                  <input
                    type="text"
                    name="speaker"
                    value={sessionData.speaker}
                    onChange={handleSessionChange}
                    placeholder="Dr. Jane Smith"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
                  />
                </div>

                <div className="mb-4">
                  <label className="block mb-2 font-medium text-gray-700">Speaker Title/Position</label>
                  <input
                    type="text"
                    name="speakerTitle"
                    value={sessionData.speakerTitle}
                    onChange={handleSessionChange}
                    placeholder="Chief AI Researcher at XYZ Corp"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium text-gray-700">Speaker Bio</label>
                  <textarea
                    name="speakerBio"
                    value={sessionData.speakerBio}
                    onChange={handleSessionChange}
                    placeholder="Brief bio and expertise..."
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
                  ></textarea>
                </div>
              </div>

              {/* Upload Slides */}
              <div className="mb-6">
                <label className="block mb-2 font-semibold text-gray-700 flex items-center gap-2">
                  <FileText size={18} /> Upload Presentation Slides (PDF/PPT) *
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.ppt,.pptx"
                  onChange={handleSlideUpload}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400"
                />
                {slideFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {slideFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                        <span className="text-sm flex items-center gap-2">
                          <FileText size={16} className="text-purple-600" />
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSlideFile(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  AI will extract text from slides and generate summary with keywords
                </p>
              </div>

              {/* Upload Video */}
              <div className="mb-6">
                <label className="block mb-2 font-semibold text-gray-700 flex items-center gap-2">
                  <FileVideo size={18} /> Upload Session Video (Optional)
                </label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400"
                />
                {videoFile && (
                  <p className="mt-2 text-sm text-green-600 flex items-center gap-2">
                    <CheckCircle size={16} /> {videoFile.name}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  AI will link video timestamps with slide content
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Generating Session Card...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} /> Generate Session Card
                  </>
                )}
              </button>
            </form>

            {/* Display Generated Sessions */}
            {generatedSessions.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-bold text-gray-900 mb-4">✨ Generated Session Cards</h3>
                <div className="space-y-4">
                  {generatedSessions.map((session, index) => (
                    <div key={index} className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">{session.sessionTitle}</h4>
                          <p className="text-sm text-gray-600">{session.eventName}</p>
                        </div>
                        <span className="px-3 py-1 bg-purple-600 text-white text-xs rounded-full">
                          Session
                        </span>
                      </div>

                      {session.speaker && (
                        <div className="mb-3 p-3 bg-white rounded-lg">
                          <p className="text-sm font-semibold text-gray-900">{session.speaker}</p>
                          {session.speakerTitle && (
                            <p className="text-xs text-gray-600">{session.speakerTitle}</p>
                          )}
                        </div>
                      )}

                      <p className="text-sm text-gray-700 mb-3">
                        {session.summary || "AI-generated summary will appear here..."}
                      </p>

                      {session.keywords && session.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {session.keywords.map((keyword, i) => (
                            <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                              <Tag size={12} /> {keyword}
                            </span>
                          ))}
                        </div>
                      )}

                      {session.videoUrl && (
                        <a
                          href={session.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink size={16} /> Watch Video
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recording Consent Dialog */}
      {showRecordingDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <Video className="text-indigo-600" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Recording Permission</h3>
                <p className="text-sm text-gray-600">Choose recording option</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Do you want to record this meeting for AI transcription and summarization?
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-700">
                <strong>With Recording:</strong> AI will transcribe the meeting in real-time and generate a summary with action items after the meeting ends.
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleRecordingChoice(false)}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                No, Skip Recording
              </button>
              <button
                onClick={() => handleRecordingChoice(true)}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                Yes, Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateMeeting;