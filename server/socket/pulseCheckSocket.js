import Meeting from "../models/meetingModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";
import pulseCheckService from "../services/pulseCheckService.js";

export default (io) => {
  io.on("connection", (socket) => {
    const canAccessMeeting = async (meetingId) => {
      if (
        !socket.userRole ||
        !hasPermission(socket.userRole, "meetings", "view")
      ) {
        return false;
      }

      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        return false;
      }

      const isOwner =
        meeting.uploadedBy?.toString() === socket.userId?.toString();
      const isInSameOrg =
        meeting.organization &&
        socket.userOrganization &&
        meeting.organization.toString() === socket.userOrganization.toString();

      return isOwner || isInSameOrg;
    };

    socket.on("send_pulse_signal", async ({ roomId, signalType }) => {
      try {
        if (!roomId || !signalType) {
          socket.emit("error", { message: "Missing roomId or signalType" });
          return;
        }

        // 1. Verify Access
        if (!(await canAccessMeeting(roomId))) {
          socket.emit("error", {
            message: "Forbidden: You don't have access to this meeting",
          });
          return;
        }

        // 2. Record the signal
        await pulseCheckService.recordSignal(roomId, socket.userId, signalType);

        // 3. Check Threshold
        const { isThresholdMet, count } =
          await pulseCheckService.checkThreshold(roomId, signalType);

        // 4. Broadcast if threshold met
        if (isThresholdMet) {
          // Emitting to everyone in the room. The client-side hook will ensure only the host acts on it.
          io.to(roomId).emit("pulse_threshold_alert", {
            signalType,
            count,
          });
        }
      } catch (error) {
        console.error("Error handling send_pulse_signal:", error);
        socket.emit("error", { message: "Failed to process pulse signal" });
      }
    });
  });
};
