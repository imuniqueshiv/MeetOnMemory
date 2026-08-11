import React, { useState, useEffect, useContext, useRef } from "react";
import AppContent from "../../context/AppContent";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { meetingApi } from "../../services";
import { Play, Square, SkipForward, AlertTriangle } from "lucide-react";
import {
  formatClock,
  getItemTiming,
  readAgendaElapsedMs,
  summarizeAgendaTiming,
} from "../../utils/agendaTiming";
import { createClerkSocketOptions } from "../../services/apiClient.js";

const AgendaTimer = ({ meeting }) => {
  const { backendUrl, userData } = useContext(AppContent);
  const [agendaItems, setAgendaItems] = useState(meeting.agendaItems || []);
  const [activeItem, setActiveItem] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const overrunNotifiedRef = useRef(new Set());

  const isOrganizerOrAdmin = meeting.uploadedBy === userData?._id;

  useEffect(() => {
    // Find active item
    const currentActive = agendaItems.find((item) => item.status === "active");
    setActiveItem(currentActive || null);
    setElapsedMs(readAgendaElapsedMs(currentActive));
  }, [agendaItems]);

  useEffect(() => {
    if (!activeItem) {
      clearInterval(timerRef.current);
      return undefined;
    }

    // Issue #1159 — this used to be `setElapsedMs((prev) => prev + 1000)`, so
    // the displayed time was a count of ticks rather than a measurement.
    // Browsers clamp `setInterval` to roughly once a minute in a backgrounded
    // tab, which is exactly where a live meeting timer spends its time: the
    // clock fell minutes behind and never caught up, and the overrun warning
    // fired late or not at all. Recomputing from `startedAt` makes a dropped
    // tick cost nothing but a late repaint.
    const tick = () => setElapsedMs(readAgendaElapsedMs(activeItem));

    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => clearInterval(timerRef.current);
  }, [activeItem]);

  // Warn once per item as soon as it runs past its planned duration.
  useEffect(() => {
    if (!activeItem) return;
    const { isOverrun } = getItemTiming(activeItem, elapsedMs);
    if (!isOverrun || overrunNotifiedRef.current.has(activeItem._id)) return;

    overrunNotifiedRef.current.add(activeItem._id);
    toast.warning(
      `"${activeItem.text}" has passed its planned ${activeItem.duration} min`,
    );
  }, [activeItem, elapsedMs]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const opts = await createClerkSocketOptions({
        transports: ["websocket"],
      });
      if (cancelled) return;

      socketRef.current = io(backendUrl, opts);

      socketRef.current.on("connect", () => {
        socketRef.current.emit("join-meeting", {
          roomId: meeting._id,
          userInfo: { name: userData?.name },
        });
      });

      socketRef.current.on("agenda_timer_updated", ({ item, action }) => {
        setAgendaItems((prev) =>
          prev.map((ai) => {
            if (ai._id === item._id) return item;
            // If action is start, other items should be pending if they were active
            if (action === "start" && ai.status === "active") {
              return { ...ai, status: "pending" };
            }
            return ai;
          }),
        );
      });
    })();

    return () => {
      cancelled = true;
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [backendUrl, meeting._id, userData?.name]);

  const handleStart = async (itemId) => {
    try {
      const res = await meetingApi.startAgendaItem(meeting._id, itemId);
      if (res.data.success) {
        // Optimistic update
        setAgendaItems((prev) =>
          prev.map((ai) => {
            if (ai._id === itemId) return res.data.item;
            if (ai.status === "active") return { ...ai, status: "pending" };
            return ai;
          }),
        );
      }
    } catch (err) {
      console.error("Failed to start item:", err);
    }
  };

  const handleStop = async (itemId) => {
    try {
      const res = await meetingApi.stopAgendaItem(meeting._id, itemId);
      if (res.data.success) {
        setAgendaItems((prev) =>
          prev.map((ai) => (ai._id === itemId ? res.data.item : ai)),
        );
      }
    } catch (err) {
      console.error("Failed to stop item:", err);
    }
  };

  const handleSkip = async (itemId) => {
    try {
      const res = await meetingApi.skipAgendaItem(meeting._id, itemId);
      if (res.data.success) {
        setAgendaItems((prev) =>
          prev.map((ai) => (ai._id === itemId ? res.data.item : ai)),
        );
      }
    } catch (err) {
      console.error("Failed to skip item:", err);
    }
  };

  if (!agendaItems || agendaItems.length === 0) return null;

  const summary = summarizeAgendaTiming(agendaItems, elapsedMs);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Live Agenda
        </h3>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Planned{" "}
            <span className="font-mono text-gray-700 dark:text-gray-300">
              {formatClock(summary.plannedMs)}
            </span>{" "}
            · Actual{" "}
            <span className="font-mono text-gray-700 dark:text-gray-300">
              {formatClock(summary.actualMs)}
            </span>
          </span>
          {summary.isOverrun && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {formatClock(summary.overrunMs)} over
            </span>
          )}
        </div>
      </div>
      <div className="space-y-4">
        {agendaItems.map((item) => {
          const isActive = item.status === "active";
          const isCompleted = item.status === "completed";
          const isSkipped = item.status === "skipped";

          const {
            plannedMs,
            actualMs,
            hasPlan,
            isOverrun,
            isNearLimit,
            overrunMs,
            remainingMs,
            progressPercent,
          } = getItemTiming(item, elapsedMs);

          let borderClass = "border-gray-200 dark:border-gray-700";
          if (isActive && isOverrun)
            borderClass = "border-red-500 bg-red-50 dark:bg-red-900/20";
          else if (isActive && isNearLimit)
            borderClass = "border-amber-500 bg-amber-50 dark:bg-amber-900/20";
          else if (isActive)
            borderClass = "border-blue-500 bg-blue-50 dark:bg-blue-900/20";
          else if (isCompleted && isOverrun)
            borderClass = "border-amber-500 bg-amber-50 dark:bg-amber-900/20";
          else if (isCompleted)
            borderClass = "border-green-500 bg-green-50 dark:bg-green-900/20";
          else if (isSkipped)
            borderClass =
              "border-gray-300 bg-gray-50 dark:bg-gray-800/50 opacity-60";

          let barClass = "bg-gray-400 dark:bg-gray-500";
          if (isOverrun) barClass = "bg-red-500";
          else if (isNearLimit) barClass = "bg-amber-500";
          else if (isActive) barClass = "bg-blue-500";
          else if (isCompleted) barClass = "bg-green-500";

          let timeClass = "text-gray-700 dark:text-gray-300";
          if (isOverrun) timeClass = "text-red-600 dark:text-red-400";
          else if (isNearLimit)
            timeClass = "text-amber-600 dark:text-amber-400";

          return (
            <div
              key={item._id}
              className={`p-4 rounded-lg border transition-colors ${borderClass}`}
            >
              <div className="flex justify-between items-center gap-4">
                <div className="min-w-0">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 flex flex-wrap items-center gap-2">
                    {item.text}
                    {isActive && (
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                      </span>
                    )}
                    {isOverrun && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        Over by {formatClock(overrunMs)}
                      </span>
                    )}
                    {isActive && isNearLimit && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        {formatClock(remainingMs)} left
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Planned: {item.duration || 0} min
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div
                      className={`text-lg font-mono font-semibold ${timeClass}`}
                    >
                      {formatClock(actualMs)}
                    </div>
                    {hasPlan && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        of {formatClock(plannedMs)} planned
                      </div>
                    )}
                  </div>

                  {isOrganizerOrAdmin && !isCompleted && !isSkipped && (
                    <div className="flex gap-2">
                      {!isActive ? (
                        <button
                          onClick={() => handleStart(item._id)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition"
                          title="Start Item"
                        >
                          <Play size={18} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStop(item._id)}
                          className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition"
                          title="Stop Item"
                        >
                          <Square size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => handleSkip(item._id)}
                        className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition"
                        title="Skip Item"
                      >
                        <SkipForward size={18} />
                      </button>
                    </div>
                  )}
                  {isCompleted && (
                    <span className="text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded">
                      Done
                    </span>
                  )}
                  {isSkipped && (
                    <span className="text-sm font-medium text-gray-600 bg-gray-200 px-2 py-1 rounded">
                      Skipped
                    </span>
                  )}
                </div>
              </div>

              {hasPlan && !isSkipped && (
                <div
                  className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                  aria-label={`${item.text} progress against planned time`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AgendaTimer;
