import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";
import streamingTranscriptionService from "../services/StreamingTranscriptionService.js";

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
  const usersInRoom = {}; // roomId -> Array of { socketId, ...userInfo }
  const socketToRoom = {}; // socketId -> roomId

  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.request.headers.cookie;
      if (!cookieHeader) {
        return next(new Error("Authentication error: No cookies found"));
      }

      const cookies = parseCookie(cookieHeader);
      const token = cookies.token; // The cookie name used in the application is 'token'

      if (!token) {
        return next(new Error("Authentication error: No token found"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;

      // Fetch user with role and organization
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
    console.log("🟢 User connected:", socket.id, "User ID:", socket.userId);

    // Join a personal room for notifications
    if (socket.userId) {
      socket.join(socket.userId.toString());
    }

    // Join room
    socket.on("join-meeting", async ({ roomId, userInfo }) => {
      try {
        // RBAC: Check if user has permission to view meetings
        if (
          !socket.userRole ||
          !hasPermission(socket.userRole, "meetings", "view")
        ) {
          socket.emit("error", {
            message: "Forbidden: Insufficient permissions",
          });
          return;
        }

        // RBAC: Check if user has access to this specific meeting
        const meeting = await Meeting.findById(roomId);
        if (!meeting) {
          socket.emit("error", { message: "Meeting not found" });
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
          socket.emit("error", {
            message: "Forbidden: You don't have access to this meeting",
          });
          return;
        }

        // Initialize room array if not exists
        if (!usersInRoom[roomId]) {
          usersInRoom[roomId] = [];
        }

        const user = { socketId: socket.id, ...userInfo };
        usersInRoom[roomId].push(user);
        socketToRoom[socket.id] = roomId;

        socket.join(roomId);

        // Tell the newly joined user about other users in the room
        const usersInThisRoom = usersInRoom[roomId].filter(
          (id) => id.socketId !== socket.id,
        );
        socket.emit("all-users", usersInThisRoom);

        // Tell everyone else that a new user joined
        socket.to(roomId).emit("user-joined", user);
        console.log(`User ${socket.id} joined room: ${roomId}`);
      } catch (error) {
        console.error("Error joining meeting:", error);
        socket.emit("error", { message: "Failed to join meeting" });
      }
    });

    // WebRTC Signaling: relaying signals
    socket.on("sending-signal", (payload) => {
      // payload: { userToSignal, callerID, signal }
      io.to(payload.userToSignal).emit("user-joined-signal", {
        signal: payload.signal,
        callerID: payload.callerID,
        userInfo: payload.userInfo,
      });
    });

    socket.on("returning-signal", (payload) => {
      // payload: { signal, callerID }
      io.to(payload.callerID).emit("receiving-returned-signal", {
        signal: payload.signal,
        id: socket.id,
      });
    });

    // Toggle media state tracking (optional)
    socket.on("media-state-changed", ({ roomId, type, enabled }) => {
      socket.to(roomId).emit("user-media-changed", {
        socketId: socket.id,
        type, // 'audio' | 'video' | 'screen'
        enabled,
      });
    });

    // Disconnect handling
    socket.on("disconnect", () => {
      console.log("🔴 User disconnected:", socket.id);
      const roomId = socketToRoom[socket.id];
      let room = usersInRoom[roomId];

      if (room) {
        room = room.filter((u) => u.socketId !== socket.id);
        usersInRoom[roomId] = room;
        if (room.length === 0) {
          delete usersInRoom[roomId];
          // End transcription session when last user leaves
          streamingTranscriptionService.endSession(roomId);
        }
      }

      socket.to(roomId).emit("user-left", socket.id);
      delete socketToRoom[socket.id];
    });

    // Start transcription session
    socket.on("start-transcription", async ({ roomId }) => {
      try {
        if (!streamingTranscriptionService.isSessionActive(roomId)) {
          await streamingTranscriptionService.startSession(roomId, io);
          socket.emit("transcription-started", { roomId });
        }
      } catch (error) {
        console.error("Error starting transcription:", error);
        socket.emit("transcription-error", { message: error.message });
      }
    });

    // Stop transcription session
    socket.on("stop-transcription", async ({ roomId }) => {
      try {
        await streamingTranscriptionService.endSession(roomId);
        socket.emit("transcription-stopped", { roomId });
      } catch (error) {
        console.error("Error stopping transcription:", error);
        socket.emit("transcription-error", { message: error.message });
      }
    });

    // Process audio data for transcription
    socket.on("audio-data", ({ roomId, audioData }) => {
      try {
        streamingTranscriptionService.processAudio(roomId, audioData);
      } catch (error) {
        console.error("Error processing audio data:", error);
      }
    });
  });
};
