import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "react-toastify";
import {
  CalendarRange,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Ban,
  Pause,
  Play,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import ConvertToAsyncModal from "../components/meetings/ConvertToAsyncModal.jsx";
import { meetingSeriesApi } from "../services/meetingSeriesApi.js";
import { useRBAC } from "../hooks/useRBAC.js";

const CADENCE_LABELS = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

const MeetingSeriesList = () => {
  const { hasPermission } = useRBAC();
  const canEdit = hasPermission("meetings", "edit");
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [occurrences, setOccurrences] = useState({});
  const [loadingOccurrences, setLoadingOccurrences] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isConvertToAsyncOpen, setIsConvertToAsyncOpen] = useState(false);
  const [selectedSeriesForAsync, setSelectedSeriesForAsync] = useState(null);

  const fetchSeries = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await meetingSeriesApi.listSeries();
      if (data?.success) {
        setSeries(data.series || []);
      }
    } catch (err) {
      console.error("Failed to load meeting series", err);
      toast.error(
        err?.response?.data?.message || "Failed to load meeting series.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  const toggleOccurrences = async (seriesId) => {
    if (expandedId === seriesId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(seriesId);
    if (occurrences[seriesId]) return;

    setLoadingOccurrences((prev) => ({ ...prev, [seriesId]: true }));
    try {
      const { data } = await meetingSeriesApi.getSeriesMeetings(
        seriesId,
        1,
        50,
      );
      setOccurrences((prev) => ({
        ...prev,
        [seriesId]: data?.meetings || [],
      }));
    } catch (err) {
      console.error("Failed to load occurrences", err);
      toast.error("Failed to load series occurrences.");
    } finally {
      setLoadingOccurrences((prev) => ({ ...prev, [seriesId]: false }));
    }
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const { type, seriesId } = confirmAction;
      if (type === "cancel") {
        await meetingSeriesApi.cancelSeries(seriesId);
        toast.success("Series cancelled. Future unstarted meetings removed.");
      } else if (type === "pause") {
        await meetingSeriesApi.pauseSeries(seriesId);
        toast.success("Series paused.");
      } else if (type === "resume") {
        await meetingSeriesApi.resumeSeries(seriesId);
        toast.success("Series resumed.");
      }
      setConfirmAction(null);
      await fetchSeries();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Could not update the series.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const confirmCopy = {
    cancel: {
      title: "Cancel meeting series",
      message:
        "Cancel this series? Future unstarted occurrences will be deleted. Past meetings stay in history.",
      confirmText: "Cancel series",
      variant: "danger",
    },
    pause: {
      title: "Pause meeting series",
      message:
        "Pause this series? Existing occurrences stay on the calendar; mark it inactive until you resume.",
      confirmText: "Pause series",
      variant: "warning",
    },
    resume: {
      title: "Resume meeting series",
      message: "Resume this series and mark it active again?",
      confirmText: "Resume series",
      variant: "warning",
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-28 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Meeting series
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
              Browse recurring programs, open retrospectives, and pause or
              cancel series.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchSeries}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : series.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
              <CalendarRange className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              No meeting series yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-gray-400">
              Recurring schedules you create from Schedule Meeting will appear
              here.
            </p>
            <Link
              to="/create-meeting"
              className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Schedule a meeting
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {series.map((item) => {
              const active = item.isActive !== false;
              const expanded = expandedId === item._id;
              return (
                <li
                  key={item._id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </h2>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            active
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}
                        >
                          {active ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
                        {CADENCE_LABELS[item.recurrencePattern] ||
                          item.recurrencePattern}
                        {item.time ? ` · ${item.time}` : ""}
                        {item.occurrenceCount != null
                          ? ` · ${item.occurrenceCount} occurrence(s)`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-gray-500">
                        Next:{" "}
                        {item.nextOccurrence?.date
                          ? format(
                              new Date(item.nextOccurrence.date),
                              "MMM d, yyyy",
                            ) +
                            (item.nextOccurrence.time
                              ? ` ${item.nextOccurrence.time}`
                              : "")
                          : "None scheduled"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/meeting-series/${item._id}/retrospective`}
                        className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300"
                      >
                        Retrospective
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleOccurrences(item._id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        Occurrences
                        {expanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {canEdit &&
                        (active ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSeriesForAsync(item);
                                setIsConvertToAsyncOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              Convert to Async
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmAction({
                                  type: "pause",
                                  seriesId: item._id,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            >
                              <Pause className="h-3.5 w-3.5" /> Pause
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmAction({
                                  type: "cancel",
                                  seriesId: item._id,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                            >
                              <Ban className="h-3.5 w-3.5" /> Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                type: "resume",
                                seriesId: item._id,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            <Play className="h-3.5 w-3.5" /> Resume
                          </button>
                        ))}
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-gray-700">
                      {loadingOccurrences[item._id] ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        </div>
                      ) : (occurrences[item._id] || []).length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No occurrences found.
                        </p>
                      ) : (
                        <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
                          {(occurrences[item._id] || []).map((m) => (
                            <li
                              key={m._id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-gray-900/50"
                            >
                              <span className="font-medium text-slate-800 dark:text-gray-100">
                                #{m.seriesOccurrence || "—"} {m.title}
                              </span>
                              <span className="text-xs text-slate-500">
                                {m.date
                                  ? format(new Date(m.date), "MMM d, yyyy")
                                  : "—"}
                                {m.time ? ` · ${m.time}` : ""}
                              </span>
                              {m._id && (
                                <Link
                                  to={`/meeting/${m._id}`}
                                  className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                                >
                                  Open
                                </Link>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={runConfirmAction}
        title={
          confirmAction ? confirmCopy[confirmAction.type].title : "Confirm"
        }
        message={confirmAction ? confirmCopy[confirmAction.type].message : ""}
        confirmText={
          confirmAction
            ? confirmCopy[confirmAction.type].confirmText
            : "Confirm"
        }
        variant={
          confirmAction ? confirmCopy[confirmAction.type].variant : "danger"
        }
        isLoading={actionLoading}
      />

      <ConvertToAsyncModal
        isOpen={isConvertToAsyncOpen}
        onClose={() => {
          setIsConvertToAsyncOpen(false);
          setSelectedSeriesForAsync(null);
        }}
        meeting={selectedSeriesForAsync}
        isSeries={true}
      />
    </div>
  );
};

export default MeetingSeriesList;
