import React, { useState, useEffect, useContext, useRef } from "react";
import AppContent from "../../context/AppContent";
import { io } from "socket.io-client";
import { meetingApi } from "../../services";
import { Play, Square, SkipForward } from "lucide-react";

const AgendaTimer = ({ meeting }) => {
  const { backendUrl, userData } = useContext(AppContent);
  const [agendaItems, setAgendaItems] = useState(meeting.agendaItems || []);
  const [activeItem, setActiveItem] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const socketRef = useRef(null);
  const timerRef = useRef(null);

  const isOrganizerOrAdmin = meeting.uploadedBy === userData?._id;

  useEffect(() => {
    // Find active item
    const currentActive = agendaItems.find((item) => item.status === "active");
    setActiveItem(currentActive || null);

    if (currentActive && currentActive.startedAt) {
      const start = new Date(currentActive.startedAt).getTime();
      const current = new Date().getTime();
      setElapsedMs(current - start + (currentActive.actualDuration || 0));
    } else {
      setElapsedMs(0);
    }
  }, [agendaItems]);

  useEffect(() => {
    if (activeItem) {
      timerRef.current = setInterval(() => {
        setElapsedMs((prev) => prev + 1000);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [activeItem]);

  useEffect(() => {
    socketRef.current = io(backendUrl, {
      withCredentials: true,
      transports: ["websocket"],
    });

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

    return () => {
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

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!agendaItems || agendaItems.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Live Agenda
      </h3>
      <div className="space-y-4">
        {agendaItems.map((item) => {
          const isActive = item.status === "active";
          const isCompleted = item.status === "completed";
          const isSkipped = item.status === "skipped";

          let borderClass = "border-gray-200 dark:border-gray-700";
          if (isActive)
            borderClass = "border-blue-500 bg-blue-50 dark:bg-blue-900/20";
          else if (isCompleted)
            borderClass = "border-green-500 bg-green-50 dark:bg-green-900/20";
          else if (isSkipped)
            borderClass =
              "border-gray-300 bg-gray-50 dark:bg-gray-800/50 opacity-60";

          return (
            <div
              key={item._id}
              className={`p-4 rounded-lg border flex justify-between items-center transition-colors ${borderClass}`}
            >
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  {item.text}
                  {isActive && (
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                  )}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Planned: {item.duration || 0} min
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-lg font-mono font-semibold text-gray-700 dark:text-gray-300">
                  {isActive
                    ? formatTime(elapsedMs)
                    : formatTime(item.actualDuration || 0)}
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
          );
        })}
      </div>
    </div>
  );
};

export default AgendaTimer;
