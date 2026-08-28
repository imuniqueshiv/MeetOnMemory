export default (io) => {
  io.on("connection", (socket) => {
    socket.on("join_playbook_session", (meetingId) => {
      if (!meetingId) return;
      socket.join(`playbook_${meetingId}`);
      console.log(
        `Socket ${socket.id} joined playbook session for meeting ${meetingId}`,
      );
    });

    socket.on("start_playbook", ({ meetingId, playbookId } = {}) => {
      if (!meetingId) return;
      io.to(`playbook_${meetingId}`).emit("playbook_started", {
        playbookId,
        currentStepIndex: 0,
        startTime: Date.now(),
      });
    });

    socket.on("advance_step", ({ meetingId, stepIndex } = {}) => {
      if (!meetingId) return;
      io.to(`playbook_${meetingId}`).emit("step_changed", {
        currentStepIndex: stepIndex,
        startTime: Date.now(),
      });
    });

    socket.on("timer_warning", ({ meetingId, stepIndex } = {}) => {
      if (!meetingId) return;
      io.to(`playbook_${meetingId}`).emit("step_timer_warning", { stepIndex });
    });
  });
};
