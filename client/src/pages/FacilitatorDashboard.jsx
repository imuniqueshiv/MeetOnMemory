import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import {
  PlayCircle,
  PauseCircle,
  SkipForward,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { meetingApi } from "../services";
import AppContent from "../context/AppContent.js";
import {
  formatClock,
  getItemTiming,
  readAgendaElapsedMs,
  summarizeAgendaTiming,
} from "../utils/agendaTiming";
import { canManageAgendaTimer } from "../utils/agendaTimerAccess";
import { createClerkSocketOptions } from "../services/apiClient.js";

const FacilitatorDashboard = ({
  meeting,
  socket: externalSocket = null,
  onAdvanceAgenda,
  onNudgeParticipant,
}) => {
  const { backendUrl, userData } = useContext(AppContent);
  const [agendaItems, setAgendaItems] = useState(meeting?.agendaItems || []);
  const [currentAgendaIndex, setCurrentAgendaIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const ownedSocketRef = useRef(null);
  const timerRef = useRef(null);

  const canManage = canManageAgendaTimer(meeting, userData);

  // Sync agenda items from prop
  useEffect(() => {
    setAgendaItems(meeting?.agendaItems || []);
  }, [meeting?.agendaItems]);

  // Find active item and determine current index based on active/pending state
  const activeItem = useMemo(
    () => agendaItems.find((item) => item.status === "active") || null,
    [agendaItems],
  );

  useEffect(() => {
    if (activeItem) {
      const idx = agendaItems.findIndex((ai) => ai._id === activeItem._id);
      if (idx !== -1) {
        setCurrentAgendaIndex(idx);
      }
    } else {
      // Find first non-completed/non-skipped item or stick to current
      const nextPendingIdx = agendaItems.findIndex(
        (ai) => ai.status === "pending" || !ai.status,
      );
      if (nextPendingIdx !== -1) {
        setCurrentAgendaIndex(nextPendingIdx);
      }
    }
    setElapsedMs(readAgendaElapsedMs(activeItem));
  }, [agendaItems, activeItem]);

  // Live timer tick for active item
  useEffect(() => {
    if (!activeItem) {
      clearInterval(timerRef.current);
      return undefined;
    }

    const tick = () => setElapsedMs(readAgendaElapsedMs(activeItem));
    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => clearInterval(timerRef.current);
  }, [activeItem]);

  // Socket subscription for real-time agenda sync across facilitators
  useEffect(() => {
    const meetingId = meeting?._id;
    if (!meetingId) return undefined;

    let cancelled = false;
    let ownedSocket = null;

    const onTimerUpdated = ({ item, action }) => {
      if (!item?._id) return;
      setAgendaItems((prev) =>
        prev.map((ai) => {
          if (ai._id === item._id) return item;
          if (action === "start" && ai.status === "active") {
            return { ...ai, status: "pending" };
          }
          return ai;
        }),
      );
    };

    const attach = (sock) => {
      if (!sock?.on) return () => {};
      sock.on("agenda_timer_updated", onTimerUpdated);
      return () => sock.off?.("agenda_timer_updated", onTimerUpdated);
    };

    let detach = () => {};

    if (externalSocket) {
      detach = attach(externalSocket);
    } else if (backendUrl) {
      (async () => {
        const opts = await createClerkSocketOptions({
          transports: ["websocket"],
        });
        if (cancelled) return;

        ownedSocket = io(backendUrl, opts);
        if (cancelled) {
          ownedSocket.disconnect();
          return;
        }
        ownedSocketRef.current = ownedSocket;

        ownedSocket.on("connect", () => {
          ownedSocket.emit("join-meeting", {
            roomId: meetingId,
            userInfo: { name: userData?.name },
          });
        });

        detach = attach(ownedSocket);
      })();
    }

    return () => {
      cancelled = true;
      detach();
      ownedSocket?.disconnect();
      if (ownedSocketRef.current && ownedSocketRef.current === ownedSocket) {
        ownedSocketRef.current = null;
      }
    };
  }, [backendUrl, meeting?._id, userData?.name, externalSocket]);

  // Actions
  const handleStartCurrent = async () => {
    if (!canManage || !currentItem?._id || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await meetingApi.startAgendaItem(
        meeting._id,
        currentItem._id,
      );
      if (res.data.success) {
        setAgendaItems((prev) =>
          prev.map((ai) => {
            if (ai._id === currentItem._id) return res.data.item;
            if (ai.status === "active") return { ...ai, status: "pending" };
            return ai;
          }),
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start agenda item");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopCurrent = async () => {
    if (!canManage || !currentItem?._id || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await meetingApi.stopAgendaItem(meeting._id, currentItem._id);
      if (res.data.success) {
        setAgendaItems((prev) =>
          prev.map((ai) => (ai._id === currentItem._id ? res.data.item : ai)),
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to stop agenda item");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvance = async () => {
    if (currentAgendaIndex < agendaItems.length - 1) {
      const nextIndex = currentAgendaIndex + 1;
      const nextItem = agendaItems[nextIndex];
      setCurrentAgendaIndex(nextIndex);
      if (onAdvanceAgenda) onAdvanceAgenda(nextIndex);

      // If user has permission and next item exists, start next item
      if (canManage && nextItem?._id) {
        try {
          const res = await meetingApi.startAgendaItem(
            meeting._id,
            nextItem._id,
          );
          if (res.data.success) {
            setAgendaItems((prev) =>
              prev.map((ai) => {
                if (ai._id === nextItem._id) return res.data.item;
                if (ai.status === "active")
                  return { ...ai, status: "completed" };
                return ai;
              }),
            );
          }
        } catch {
          // Fallback gracefully
        }
      }
    }
  };

  const handleSkip = async (itemId) => {
    const targetId = itemId || currentItem?._id;
    if (!canManage || !targetId || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await meetingApi.skipAgendaItem(meeting._id, targetId);
      if (res.data.success) {
        setAgendaItems((prev) =>
          prev.map((ai) => (ai._id === targetId ? res.data.item : ai)),
        );
        if (
          targetId === currentItem?._id &&
          currentAgendaIndex < agendaItems.length - 1
        ) {
          setCurrentAgendaIndex((prev) => prev + 1);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to skip agenda item");
    } finally {
      setActionLoading(false);
    }
  };

  const currentItem = agendaItems[currentAgendaIndex];
  const timing = currentItem ? getItemTiming(currentItem, elapsedMs) : null;
  const summary = summarizeAgendaTiming(agendaItems, elapsedMs);

  // Dynamic pacing status derived from live timer signals
  const pacingStatus = useMemo(() => {
    if (summary.isOverrun) {
      return {
        label: `Over Time (${formatClock(summary.overrunMs)})`,
        colorClass: "text-red-400 border-red-500/30 bg-red-900/20",
        icon: <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />,
      };
    }
    if (timing?.isNearLimit || summary.itemsOverrun > 0) {
      return {
        label: "Pacing: Behind Schedule",
        colorClass: "text-amber-400 border-amber-500/30 bg-amber-900/20",
        icon: <AlertCircle className="w-5 h-5 text-amber-400 mr-2" />,
      };
    }
    if (activeItem) {
      return {
        label: "Pacing: On Track",
        colorClass: "text-emerald-400 border-emerald-500/30 bg-emerald-900/20",
        icon: <Clock className="w-5 h-5 text-emerald-400 mr-2" />,
      };
    }
    return {
      label: "Pacing: Ready",
      colorClass: "text-blue-400 border-slate-700 bg-slate-800",
      icon: <Clock className="w-5 h-5 text-blue-400 mr-2" />,
    };
  }, [summary, timing, activeItem]);

  return (
    <div
      data-testid="facilitator-dashboard"
      className="flex flex-col h-full bg-slate-900 text-white p-6"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <span className="text-amber-400 mr-3">👑</span> Facilitator
            Dashboard
          </h1>
          <p className="text-slate-400 mt-1">{meeting?.title || "Meeting"}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div
            data-testid="pacing-badge"
            className={`px-4 py-2 rounded-lg flex items-center border ${pacingStatus.colorClass}`}
          >
            {pacingStatus.icon}
            <span className="font-mono text-lg">{pacingStatus.label}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 flex-1">
        {/* Agenda Control Panel */}
        <div className="col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-300">
              Live Agenda Control
            </h2>
            {!canManage && (
              <span className="text-xs bg-slate-700 text-slate-400 px-2 py-1 rounded">
                View Only
              </span>
            )}
          </div>

          {currentItem ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-8 bg-slate-700/50 rounded-xl border border-slate-600 mb-6">
              <span className="text-blue-400 font-medium mb-2 uppercase tracking-wider text-sm flex items-center gap-1.5">
                Current Item ({currentAgendaIndex + 1} of {agendaItems.length})
                {currentItem.status === "active" && (
                  <span className="flex h-2.5 w-2.5 relative ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                  </span>
                )}
              </span>

              <h3 className="text-3xl font-bold mb-2">{currentItem.text}</h3>
              <p className="text-slate-400 mb-4 max-w-lg">
                {currentItem.description || "No description provided."}
              </p>

              {/* Timing metrics */}
              <div className="flex items-center gap-6 mb-6 font-mono text-sm bg-slate-800/80 px-4 py-2 rounded-lg border border-slate-700">
                <div>
                  <span className="text-slate-400 block text-xs">Planned</span>
                  <span className="text-slate-200 font-bold">
                    {currentItem.duration || 0}m
                  </span>
                </div>
                <div className="border-l border-slate-700 pl-6">
                  <span className="text-slate-400 block text-xs">Elapsed</span>
                  <span
                    className={`font-bold text-base ${
                      timing?.isOverrun
                        ? "text-red-400"
                        : timing?.isNearLimit
                          ? "text-amber-400"
                          : "text-blue-400"
                    }`}
                  >
                    {formatClock(timing?.actualMs || 0)}
                  </span>
                </div>
                {timing?.hasPlan && (
                  <div className="border-l border-slate-700 pl-6">
                    <span className="text-slate-400 block text-xs">
                      {timing.isOverrun ? "Overrun" : "Remaining"}
                    </span>
                    <span
                      className={`font-bold ${
                        timing.isOverrun ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {timing.isOverrun
                        ? `+${formatClock(timing.overrunMs)}`
                        : `${formatClock(timing.remainingMs)}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {canManage && (
                  <>
                    {currentItem.status !== "active" ? (
                      <button
                        onClick={handleStartCurrent}
                        disabled={actionLoading}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium flex items-center transition-colors disabled:opacity-50 text-sm"
                      >
                        <PlayCircle className="w-4 h-4 mr-2" />
                        Start Timer
                      </button>
                    ) : (
                      <button
                        onClick={handleStopCurrent}
                        disabled={actionLoading}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-500 rounded-lg font-medium flex items-center transition-colors disabled:opacity-50 text-sm"
                      >
                        <PauseCircle className="w-4 h-4 mr-2" />
                        Pause Timer
                      </button>
                    )}

                    <button
                      onClick={() => handleSkip(currentItem._id)}
                      disabled={actionLoading}
                      className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium flex items-center transition-colors disabled:opacity-50 text-sm"
                    >
                      <SkipForward className="w-4 h-4 mr-1.5" />
                      Skip Item
                    </button>
                  </>
                )}

                <button
                  onClick={handleAdvance}
                  disabled={currentAgendaIndex >= agendaItems.length - 1}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium flex items-center transition-colors disabled:opacity-40 text-sm"
                >
                  Advance to Next Item
                  <ChevronRight className="w-4 h-4 ml-1.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/50 mb-3" />
              <p className="text-lg">Agenda completed.</p>
            </div>
          )}

          {/* Upcoming Items List */}
          <div className="bg-slate-900 rounded-lg p-4 max-h-48 overflow-y-auto">
            <h4 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">
              Upcoming Items ({agendaItems.slice(currentAgendaIndex + 1).length}
              )
            </h4>
            <div className="space-y-2">
              {agendaItems.slice(currentAgendaIndex + 1).map((item, idx) => (
                <div
                  key={item._id || idx}
                  className="flex justify-between items-center p-3 bg-slate-800 rounded border border-slate-700 opacity-80 hover:opacity-100 transition-opacity"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                      {currentAgendaIndex + idx + 2}
                    </span>
                    <span className="truncate">{item.text}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400">
                      {item.duration || 0}m
                    </span>
                    {canManage && (
                      <button
                        onClick={() => handleSkip(item._id)}
                        className="text-xs text-slate-400 hover:text-red-400 p-1"
                        title="Skip item"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Participant Management */}
        <div className="col-span-1 bg-slate-800 rounded-xl p-6 border border-slate-700 flex flex-col">
          <h2 className="text-lg font-semibold mb-4 text-slate-300">
            Participant Controls
          </h2>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
            {(meeting?.participants || []).map((p) => (
              <div
                key={p.user || p._id}
                className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className="w-8 h-8 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center font-medium border border-blue-500/30 shrink-0">
                    {(p.name || "U").charAt(0)}
                  </div>
                  <div className="truncate">
                    <p className="font-medium text-sm text-slate-200 truncate">
                      {p.name || "Participant"}
                    </p>
                    {p.role && (
                      <p className="text-xs text-slate-400">{p.role}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() =>
                    onNudgeParticipant && onNudgeParticipant(p.user || p._id)
                  }
                  className="p-2 text-amber-400 hover:bg-amber-400/10 rounded-md transition-colors shrink-0"
                  title="Nudge Participant (Off-topic)"
                >
                  <AlertCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacilitatorDashboard;
