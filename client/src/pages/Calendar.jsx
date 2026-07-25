import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import CalendarGrid from "../components/calendar/CalendarGrid";
import MeetingDetailsModal from "../components/calendar/MeetingDetailsModal";
import { getWeekDays } from "../components/calendar/calendarUtils";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Loader2,
  Inbox,
  Cloud,
} from "lucide-react";

const Calendar = () => {
  const navigate = useNavigate();

  const {
    loading,
    currentDate,
    setCurrentDate,
    view,
    setView,
    selectedMeeting,
    setSelectedMeeting,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    orgFilter,
    setOrgFilter,
    showExternalEvents,
    setShowExternalEvents,
    filteredMeetings,
    uniqueOrgs,
  } = useCalendarEvents();

  // Handle outside click to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedMeeting(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedMeeting]);

  // Navigation helpers
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else if (view === "week") {
      newDate.setDate(currentDate.getDate() - 7);
    } else {
      newDate.setDate(currentDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(currentDate.getMonth() + 1);
    } else if (view === "week") {
      newDate.setDate(currentDate.getDate() + 7);
    } else {
      newDate.setDate(currentDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Format Date string title
  const getHeaderDateString = () => {
    if (view === "month") {
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    } else if (view === "week") {
      const week = getWeekDays(currentDate);
      const start = week[0];
      const end = week[6];
      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString("en-US", { month: "short" })} ${start.getFullYear()}`;
      } else {
        return `${start.toLocaleDateString("en-US", { month: "short" })} - ${end.toLocaleDateString("en-US", { month: "short" })} ${end.getFullYear()}`;
      }
    } else {
      return currentDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 flex flex-col font-sans select-none">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 flex flex-col">
        {/* Navigation & Toolbar Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-5 border-b border-slate-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <CalendarIcon className="w-7 h-7 text-blue-600" />
              Calendar & Schedule
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs sm:text-sm">
              Visualize your upcoming schedule, review minutes, and manage
              meeting timelines.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => {
                window.location.href =
                  "http://localhost:4000/api/auth/google-calendar";
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 rounded-xl transition-all shadow-sm cursor-pointer w-full md:w-auto justify-center"
            >
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              Sync Google Calendar
            </button>
            <button
              onClick={() => navigate("/create-meeting")}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-600/10 cursor-pointer w-full md:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              Schedule Meeting
            </button>
          </div>
        </div>

        {/* Calendar Nav + Filters Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Prev/Next buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs shrink-0">
                <button
                  onClick={handlePrev}
                  className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700 cursor-pointer"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToday}
                  className="px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer bg-white dark:bg-slate-900"
                >
                  Today
                </button>
                <button
                  onClick={handleNext}
                  className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700 cursor-pointer"
                  aria-label="Next"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-sans tracking-tight ml-2">
                {getHeaderDateString()}
              </h2>
            </div>

            {/* View togglers */}
            <div className="bg-slate-100/80 dark:bg-slate-800 p-0.5 rounded-xl flex border border-slate-200/40 dark:border-slate-700 w-full sm:w-auto shadow-inner">
              {["month", "week", "day"].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg capitalize transition-all cursor-pointer ${
                    view === v
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs border border-slate-200/20"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filters:</span>
            </div>

            {/* External events toggle */}
            <button
              onClick={() => setShowExternalEvents(!showExternalEvents)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                showExternalEvents
                  ? "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>External Events</span>
            </button>

            {/* Date filter (Jump to Date) */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 select-none">
              <span className="text-[10px] text-slate-400 uppercase font-bold mr-1">
                Date:
              </span>
              <input
                type="date"
                value={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`}
                onChange={(e) => {
                  if (e.target.value) {
                    setCurrentDate(new Date(e.target.value + "T00:00:00"));
                  }
                }}
                className="bg-transparent border-none text-slate-700 dark:text-slate-300 outline-none cursor-pointer text-xs font-semibold"
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 outline-none transition-all cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="uploaded">Uploaded / Upcoming</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 outline-none transition-all cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="conference">Conference</option>
              <option value="policy">Policy</option>
              <option value="event">Event</option>
              <option value="internal">Internal</option>
            </select>

            {/* Org Filter */}
            <select
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 outline-none transition-all cursor-pointer"
            >
              <option value="all">All Organizations</option>
              <option value="personal">Personal Meetings (None)</option>
              {uniqueOrgs.map((org) => (
                <option key={org} value={org}>
                  {org}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex-1 min-h-[400px] flex flex-col justify-center items-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
            <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
            <span className="ml-3 text-slate-500 dark:text-slate-400 font-medium mt-2">
              Fetching meetings...
            </span>
          </div>
        ) : filteredMeetings.length === 0 ? (
          /* Empty State */
          <div className="flex-1 min-h-[400px] flex flex-col justify-center items-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xs">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700">
              <Inbox className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              No Scheduled Meetings
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 max-w-sm">
              There are no meetings scheduled matching the selected filters.
              Change filters or create a new meeting.
            </p>
            <button
              onClick={() => navigate("/create-meeting")}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Schedule New Meeting
            </button>
          </div>
        ) : (
          <CalendarGrid
            view={view}
            currentDate={currentDate}
            filteredMeetings={filteredMeetings}
            setSelectedMeeting={setSelectedMeeting}
          />
        )}
      </main>

      <MeetingDetailsModal
        selectedMeeting={selectedMeeting}
        setSelectedMeeting={setSelectedMeeting}
      />
    </div>
  );
};

export default Calendar;
