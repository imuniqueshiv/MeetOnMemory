import Meeting from "../models/meetingModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";
import streamingTranscriptionService from "../services/StreamingTranscriptionService.js";
import authenticateSocket from "../middleware/socketAuth.js";

export default (io) => {
  const usersInRoom = {}; // roomId -> Array of { socketId, ...userInfo }
  const socketToRoom = {}; // socketId -> roomId
  const roomTimers = {}; // roomId -> { isRunning: boolean, elapsed: number, remaining: number, currentAgendaItem: null | string, lastUpdate: number }

  // Authentication Middleware with Clerk & Dual Auth support
  io.use(authenticateSocket);

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
        meeting.uploadedBy?.toString() === socket.userId.toString();

      const isInSameOrg =
        meeting.organization &&
        socket.userOrganization &&
        meeting.organization.toString() === socket.userOrganization.toString();

      return isOwner || isInSameOrg;
    };
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

        // Initialize timer state if it doesn't exist
        if (!roomTimers[roomId]) {
          roomTimers[roomId] = {
            isRunning: false,
            elapsed: 0,
            remaining: 0,
            currentAgendaItem: null,
            lastUpdate: Date.now(),
          };
        }

        // Update elapsed time if running before sending to newly joined user
        if (roomTimers[roomId].isRunning) {
          const now = Date.now();
          const diff = Math.floor((now - roomTimers[roomId].lastUpdate) / 1000);
          // We don't mutate elapsed here, just send the calculated value
          const syncState = {
            ...roomTimers[roomId],
            elapsed: roomTimers[roomId].elapsed + diff,
            remaining: Math.max(0, roomTimers[roomId].remaining - diff),
          };
          socket.emit("timer-sync", syncState);
        } else {
          socket.emit("timer-sync", roomTimers[roomId]);
        }

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
          delete roomTimers[roomId];
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
        if (!(await canAccessMeeting(roomId))) {
          socket.emit("transcription-error", {
            message: "Forbidden: You don't have access to this meeting",
          });
          return;
        }

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
        if (!(await canAccessMeeting(roomId))) {
          socket.emit("transcription-error", {
            message: "Forbidden: You don't have access to this meeting",
          });
          return;
        }

        await streamingTranscriptionService.endSession(roomId);
        socket.emit("transcription-stopped", { roomId });
      } catch (error) {
        console.error("Error stopping transcription:", error);
        socket.emit("transcription-error", { message: error.message });
      }
    });

    // Process audio data for transcription
    socket.on("audio-data", async ({ roomId, audioData }) => {
      try {
        if (!(await canAccessMeeting(roomId))) {
          socket.emit("transcription-error", {
            message: "Forbidden: You don't have access to this meeting",
          });
          return;
        }

        streamingTranscriptionService.processAudio(roomId, audioData);
      } catch (error) {
        console.error("Error processing audio data:", error);
      }
    });

    // Timer synchronization
    socket.on("timer-control", ({ roomId, action, payload }) => {
      if (!roomTimers[roomId]) {
        roomTimers[roomId] = {
          isRunning: false,
          elapsed: 0,
          remaining: 0,
          currentAgendaItem: null,
          lastUpdate: Date.now(),
        };
      }

      const timer = roomTimers[roomId];
      const now = Date.now();

      if (timer.isRunning) {
        const diff = Math.floor((now - timer.lastUpdate) / 1000);
        timer.elapsed += diff;
        timer.remaining = Math.max(0, timer.remaining - diff);
      }
      timer.lastUpdate = now;

      switch (action) {
        case "start":
        case "resume":
          timer.isRunning = true;
          break;
        case "pause":
          timer.isRunning = false;
          break;
        case "reset":
          timer.isRunning = false;
          timer.elapsed = 0;
          timer.remaining = payload?.remaining || 0;
          break;
        case "set-agenda":
          timer.currentAgendaItem = payload?.agendaItem;
          if (payload?.remaining !== undefined) {
            timer.remaining = payload.remaining;
            timer.elapsed = 0;
          }
          break;
        case "sync":
          if (payload) {
            timer.elapsed = payload.elapsed;
            timer.remaining = payload.remaining;
          }
          break;
      }

      io.to(roomId).emit("timer-sync", timer);
    });
  });
};
