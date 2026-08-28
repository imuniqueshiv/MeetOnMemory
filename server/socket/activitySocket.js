/**
 * Organization activity feed room membership.
 *
 * Membership is derived from the authenticated socket identity; clients can
 * only join/leave their own organization room.
 */
export default (io) => {
  io.on("connection", (socket) => {
    socket.on("activity:join", ({ organizationId } = {}) => {
      const socketOrgId = socket.userOrganization?.toString();
      if (!socketOrgId || !organizationId) {
        socket.emit("activity:error", {
          message: "Organization is required to join the activity feed.",
        });
        return;
      }

      if (socketOrgId !== organizationId.toString()) {
        socket.emit("activity:error", {
          message: "Forbidden: organization does not match your account.",
        });
        return;
      }

      socket.join(`org_${socketOrgId}`);
      socket.emit("activity:joined", { organizationId: socketOrgId });
    });

    socket.on("activity:leave", ({ organizationId } = {}) => {
      const socketOrgId = socket.userOrganization?.toString();
      if (socketOrgId && organizationId?.toString() === socketOrgId) {
        socket.leave(`org_${socketOrgId}`);
      }
    });
  });
};
