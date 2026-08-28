import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient.js";
import Navbar from "../components/Navbar.jsx";
import {
  Calendar,
  Filter,
  RefreshCw,
  ChevronRight,
  MessageSquare,
  CheckSquare,
  Users,
  Tag,
  Clock,
  ChevronLeft,
  Search,
} from "lucide-react";
import { toast } from "react-toastify";

const OrgTimelineDashboard = () => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [teamId, setTeamId] = useState("");
  const [tag, setTag] = useState("");
  const [seriesId, setSeriesId] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMeetings, setTotalMeetings] = useState(0);

  // Fetch series list on mount
  useEffect(() => {
    apiClient
      .get("/api/meeting-series")
      .then((res) => {
        const data = res.data;
        setSeriesList(Array.isArray(data) ? data : data.data || []);
      })
      .catch((err) => {
        console.error("Failed to load series list:", err);
      });
  }, []);

  // Fetch timeline meetings
  const fetchTimeline = useCallback(() => {
    setLoading(true);
    const params = {
      page,
      limit,
      teamId: teamId || undefined,
      tag: tag || undefined,
      seriesId: seriesId || undefined,
    };

    apiClient
      .get("/api/analytics/org-timeline", { params })
      .then((res) => {
        const { data, pagination } = res.data;
        setMeetings(data || []);
        if (pagination) {
          setTotalPages(pagination.totalPages || 1);
          setTotalMeetings(pagination.totalMeetings || 0);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch timeline data:", err);
        toast.error("Failed to load timeline data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page, limit, teamId, tag, seriesId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Reset all filters
  const handleResetFilters = () => {
    setTeamId("");
    setTag("");
    setSeriesId("");
    setPage(1);
  };

  // Group meetings by date for the chronological timeline display
  const groupMeetingsByDate = (meetingsList) => {
    const groups = {};
    meetingsList.forEach((meeting) => {
      const dateStr = meeting.date
        ? new Date(meeting.date).toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "Undated Meetings";
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(meeting);
    });
    return Object.entries(groups);
  };

  const groupedMeetings = groupMeetingsByDate(meetings);

  return (
    <div className="org-timeline-page min-h-screen bg-slate-950 text-white font-sans flex flex-col md:flex-row">
      <Navbar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-8 py-6 sticky top-0 z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <Clock className="text-violet-500 w-7 h-7 animate-pulse" />
              Organization Timeline
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Executive chronological multi-meeting overview and insights
            </p>
          </div>
          <button
            onClick={fetchTimeline}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-850 hover:bg-slate-800 transition text-xs font-semibold text-slate-200 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
          {/* Filters Panel */}
          <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 mb-8 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-violet-400" />
              Filters
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              {/* Team ID */}
              <div>
                <label
                  className="block text-xs font-medium text-slate-400 mb-1.5"
                  htmlFor="teamFilter"
                >
                  Team / Department
                </label>
                <select
                  id="teamFilter"
                  value={teamId}
                  onChange={(e) => {
                    setTeamId(e.target.value);
                    setPage(1);
                  }}
                  className="w-full text-xs p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-violet-500 transition"
                >
                  <option value="">All Teams...</option>
                  <option value="team-eng">Engineering</option>
                  <option value="team-prod">Product Management</option>
                  <option value="team-design">Design</option>
                  <option value="team-marketing">Marketing</option>
                  <option value="team-sales">Sales</option>
                </select>
              </div>

              {/* Tag Search */}
              <div>
                <label
                  className="block text-xs font-medium text-slate-400 mb-1.5"
                  htmlFor="tagFilter"
                >
                  Tag
                </label>
                <div className="relative">
                  <input
                    id="tagFilter"
                    type="text"
                    placeholder="e.g. Q3_Review"
                    value={tag}
                    onChange={(e) => {
                      setTag(e.target.value);
                      setPage(1);
                    }}
                    className="w-full text-xs pl-8 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3.5" />
                </div>
              </div>

              {/* Series Filter */}
              <div>
                <label
                  className="block text-xs font-medium text-slate-400 mb-1.5"
                  htmlFor="seriesFilter"
                >
                  Meeting Series
                </label>
                <select
                  id="seriesFilter"
                  value={seriesId}
                  onChange={(e) => {
                    setSeriesId(e.target.value);
                    setPage(1);
                  }}
                  className="w-full text-xs p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-violet-500 transition"
                >
                  <option value="">All Series...</option>
                  {seriesList.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset button */}
              <button
                onClick={handleResetFilters}
                className="w-full text-xs py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition font-medium text-slate-300"
              >
                Clear Filters
              </button>
            </div>
          </section>

          {/* Timeline View */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="w-10 h-10 text-violet-500 animate-spin mb-4" />
              <p className="text-sm text-slate-400">
                Loading chronological timeline...
              </p>
            </div>
          ) : meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
              <Calendar className="w-12 h-12 text-slate-600 mb-4" />
              <h3 className="text-base font-semibold text-slate-300">
                No Meetings Found
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
                No meetings match your selected filters. Try broadening your
                criteria.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-800 ml-4 md:ml-6 pl-6 md:pl-8 space-y-12">
              {groupedMeetings.map(([dateString, dateMeetings]) => (
                <div key={dateString} className="relative">
                  {/* Timeline point */}
                  <span className="absolute -left-[39px] md:-left-[47px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 border-2 border-violet-500">
                    <span className="h-2 w-2 rounded-full bg-violet-400" />
                  </span>

                  <h3 className="text-sm font-semibold tracking-wide text-violet-400 uppercase mb-6">
                    {dateString}
                  </h3>

                  <div className="grid grid-cols-1 gap-6">
                    {dateMeetings.map((meeting) => (
                      <article
                        key={meeting.meetingId}
                        className="bg-slate-900/40 border border-slate-850 hover:border-slate-700 rounded-xl p-5 hover:bg-slate-900/70 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-2 max-w-2xl">
                          <div className="flex flex-wrap items-center gap-2">
                            {meeting.seriesName && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-violet-950/60 text-violet-300 border border-violet-850">
                                {meeting.seriesName}
                              </span>
                            )}
                            {meeting.teamName && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-850">
                                {meeting.teamName}
                              </span>
                            )}
                          </div>

                          <h4
                            onClick={() =>
                              navigate(`/meetings/${meeting.meetingId}`)
                            }
                            className="text-base font-bold text-white hover:text-violet-400 cursor-pointer transition"
                          >
                            {meeting.title}
                          </h4>

                          {/* Tags */}
                          {meeting.tags && meeting.tags.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              {meeting.tags.map((t, idx) => (
                                <span
                                  key={idx}
                                  onClick={() => setTag(t)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer border border-slate-700 transition"
                                >
                                  <Tag className="w-2.5 h-2.5" />
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Stats & Deep Links */}
                        <div className="flex items-center gap-6 self-start md:self-auto">
                          {/* Attendees */}
                          <div className="flex flex-col items-center justify-center text-center text-slate-400">
                            <span className="flex items-center gap-1 text-xs">
                              <Users className="w-3.5 h-3.5 text-slate-500" />
                              {meeting.attendeeCount || 0}
                            </span>
                            <span className="text-[10px] text-slate-500 mt-0.5">
                              Attendees
                            </span>
                          </div>

                          {/* Decisions */}
                          <div
                            onClick={() =>
                              navigate(
                                `/meetings/${meeting.meetingId}#decisions`,
                              )
                            }
                            className="flex flex-col items-center justify-center text-center text-slate-400 hover:text-amber-400 cursor-pointer transition group"
                          >
                            <span className="flex items-center gap-1 text-xs">
                              <MessageSquare className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition" />
                              {meeting.decisionCount || 0}
                            </span>
                            <span className="text-[10px] text-slate-500 mt-0.5">
                              Decisions
                            </span>
                          </div>

                          {/* Action Items */}
                          <div
                            onClick={() =>
                              navigate(`/meetings/${meeting.meetingId}#tasks`)
                            }
                            className="flex flex-col items-center justify-center text-center text-slate-400 hover:text-teal-400 cursor-pointer transition group"
                          >
                            <span className="flex items-center gap-1 text-xs">
                              <CheckSquare className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition" />
                              {meeting.actionItemCount || 0}
                            </span>
                            <span className="text-[10px] text-slate-500 mt-0.5">
                              Action Items
                            </span>
                          </div>

                          {/* Navigation Icon */}
                          <button
                            onClick={() =>
                              navigate(`/meetings/${meeting.meetingId}`)
                            }
                            className="p-2 rounded-lg bg-slate-800 hover:bg-violet-600 transition text-slate-300 hover:text-white"
                            aria-label="View Details"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-850 mt-12 pt-6">
              <p className="text-xs text-slate-400">
                Showing page{" "}
                <span className="font-semibold text-white">{page}</span> of{" "}
                <span className="font-semibold text-white">{totalPages}</span> (
                <span className="font-semibold text-white">
                  {totalMeetings}
                </span>{" "}
                total meetings)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-850 hover:bg-slate-800 text-xs font-semibold text-slate-200 disabled:opacity-40 disabled:hover:bg-slate-850 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-850 hover:bg-slate-800 text-xs font-semibold text-slate-200 disabled:opacity-40 disabled:hover:bg-slate-850 transition"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default OrgTimelineDashboard;
