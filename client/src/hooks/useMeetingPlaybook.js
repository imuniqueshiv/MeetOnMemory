import { useState, useEffect, useCallback } from "react";

export const useMeetingPlaybook = (socket, meetingId) => {
  const [playbookState, setPlaybookState] = useState({
    isActive: false,
    playbookId: null,
    currentStepIndex: 0,
    startTime: null,
    timerWarning: false,
  });

  useEffect(() => {
    if (!socket || !meetingId) return;

    socket.emit("join_playbook_session", meetingId);

    const handlePlaybookStarted = (data) => {
      setPlaybookState({
        isActive: true,
        playbookId: data.playbookId,
        currentStepIndex: data.currentStepIndex,
        startTime: data.startTime,
        timerWarning: false,
      });
    };

    const handleStepChanged = (data) => {
      setPlaybookState((prev) => ({
        ...prev,
        currentStepIndex: data.currentStepIndex,
        startTime: data.startTime,
        timerWarning: false,
      }));
    };

    const handleTimerWarning = (data) => {
      if (data.stepIndex === playbookState.currentStepIndex) {
        setPlaybookState((prev) => ({ ...prev, timerWarning: true }));
      }
    };

    socket.on("playbook_started", handlePlaybookStarted);
    socket.on("step_changed", handleStepChanged);
    socket.on("step_timer_warning", handleTimerWarning);

    return () => {
      socket.off("playbook_started", handlePlaybookStarted);
      socket.off("step_changed", handleStepChanged);
      socket.off("step_timer_warning", handleTimerWarning);
    };
  }, [socket, meetingId, playbookState.currentStepIndex]);

  const startPlaybook = useCallback(
    (playbookId) => {
      if (socket && meetingId) {
        socket.emit("start_playbook", { meetingId, playbookId });
      }
    },
    [socket, meetingId],
  );

  const advanceStep = useCallback(
    (nextStepIndex) => {
      if (socket && meetingId) {
        socket.emit("advance_step", { meetingId, stepIndex: nextStepIndex });
      }
    },
    [socket, meetingId],
  );

  const emitTimerWarning = useCallback(
    (stepIndex) => {
      if (socket && meetingId) {
        socket.emit("timer_warning", { meetingId, stepIndex });
      }
    },
    [socket, meetingId],
  );

  return {
    playbookState,
    startPlaybook,
    advanceStep,
    emitTimerWarning,
  };
};
