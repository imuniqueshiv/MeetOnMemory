import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";

const TimerContext = createContext(null);

export const TimerProvider = ({ children, socket, roomId }) => {
  const [timerState, setTimerState] = useState({
    isRunning: false,
    elapsed: 0,
    remaining: 0,
    currentAgendaItem: null,
  });

  const stateRef = useRef(timerState);

  useEffect(() => {
    if (!socket) return;

    const handleSync = (serverState) => {
      setTimerState((prev) => ({ ...prev, ...serverState }));
      stateRef.current = { ...stateRef.current, ...serverState };
    };

    socket.on("timer-sync", handleSync);

    return () => {
      socket.off("timer-sync", handleSync);
    };
  }, [socket]);

  useEffect(() => {
    let interval;
    if (timerState.isRunning) {
      interval = setInterval(() => {
        setTimerState((prev) => {
          const next = {
            ...prev,
            elapsed: prev.elapsed + 1,
            remaining: Math.max(0, prev.remaining - 1),
          };
          stateRef.current = next;
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerState.isRunning]);

  const startTimer = () =>
    socket?.emit("timer-control", { action: "start", roomId });
  const pauseTimer = () =>
    socket?.emit("timer-control", { action: "pause", roomId });
  const resumeTimer = () =>
    socket?.emit("timer-control", { action: "resume", roomId });
  const resetTimer = (remaining = 0) =>
    socket?.emit("timer-control", {
      action: "reset",
      roomId,
      payload: { remaining },
    });
  const setAgenda = (agendaItem, remaining) =>
    socket?.emit("timer-control", {
      action: "set-agenda",
      roomId,
      payload: { agendaItem, remaining },
    });
  const syncTimer = () =>
    socket?.emit("timer-control", {
      action: "sync",
      roomId,
      payload: {
        elapsed: stateRef.current.elapsed,
        remaining: stateRef.current.remaining,
      },
    });

  const value = {
    ...timerState,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    setAgenda,
    syncTimer,
  };

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
};
