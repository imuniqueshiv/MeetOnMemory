import jwt from "jsonwebtoken";
import Transcript from "../models/transcriptModel.js";
import Meeting from "../models/meetingModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";

const parseCookie = (str) =>
  str
    .split(";")
    .map((v) => v.split("="))
    .reduce((acc, v) => {
      if (v[0] && v[1] !== undefined) {
        acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
      }
      return acc;
    }, {});

export default (io) => {
  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.request.headers.cookie;
      if (!cookieHeader) {
        return next(new Error("Authentication error: No cookies found"));
      }

      const cookies = parseCookie(cookieHeader);
      const token = cookies.token;

      if (!token) {
        return next(new Error("Authentication error: No token found"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;

      // Fetch user with role and organization
      const userModel = (await import("../models/userModel.js")).default;
      const user = await userModel.findById(decoded.id);
      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      socket.userRole = user.role;
      socket.userOrganization = user.organization;
      next();
    } catch (error) {
      console.error("Socket authentication error:", error.message);
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log("🟢 User connected to transcript socket:", socket.id);

    // Join transcript room for a meeting
    socket.on("join-transcript-room", async ({ meetingId }) => {
      try {
        // RBAC: Check if user has permission to view meetings
        if (
          !socket.userRole ||
          !hasPermission(socket.userRole, "meetings", "view")
        ) {
          socket.emit("transcript-error", {
            message: "Forbidden: Insufficient permissions",
          });
          return;
        }

        // RBAC: Check if user has access to this specific meeting
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
          socket.emit("transcript-error", { message: "Meeting not found" });
          return;
        }

        const isOwner =
          meeting.uploadedBy?.toString() === socket.userId.toString();
        const isInSameOrg =
          meeting.organization &&
          socket.userOrganization &&
          meeting.organization.toString() ===
            socket.userOrganization.toString();

        if (!isOwner && !isInSameOrg) {
          socket.emit("transcript-error", {
            message: "Forbidden: You don't have access to this meeting",
          });
          return;
        }

        const roomId = `meeting:${meetingId}:transcript`;
        socket.join(roomId);

        // Send current transcript status
        const transcript = await Transcript.findOne({ meetingId });
        if (transcript) {
          socket.emit("transcript-status", {
            status: transcript.status,
            segments: transcript.segments,
            fullText: transcript.fullText,
          });
        }

        console.log(`User ${socket.id} joined transcript room: ${roomId}`);
      } catch (error) {
        console.error("Error joining transcript room:", error);
        socket.emit("transcript-error", { message: "Failed to join transcript room" });
      }
    });

    // Leave transcript room
    socket.on("leave-transcript-room", ({ meetingId }) => {
      const roomId = `meeting:${meetingId}:transcript`;
      socket.leave(roomId);
      console.log(`User ${socket.id} left transcript room: ${roomId}`);
    });

    // Broadcast partial transcript segment (real-time)
    socket.on("transcript-segment", ({ meetingId, segment }) => {
      const roomId = `meeting:${meetingId}:transcript`;
      socket.to(roomId).emit("transcript-segment", segment);
    });

    // Broadcast final transcript
    socket.on("transcript-final", ({ meetingId, transcript }) => {
      const roomId = `meeting:${meetingId}:transcript`;
      io.to(roomId).emit("transcript-final", transcript);
    });

    // Disconnect handling
    socket.on("disconnect", () => {
      console.log("🔴 User disconnected from transcript socket:", socket.id);
    });
  });
};
