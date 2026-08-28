import Meeting from "../models/meetingModel.js";
import { hasPermission } from "../utils/rbacPermissions.js";
import streamingTranscriptionService from "../services/StreamingTranscriptionService.js";
import { getRedisClient } from "../services/redisService.js";

/**
 * Meeting Socket Handler with Multi-Instance Presence Support
 *
 * This module handles real-time meeting presence and synchronization across
 * multiple server instances using Redis for distributed state management.
 *
 * Key Features:
 * - Distributed presence tracking via Redis
 * - Room-based user management
 * - WebRTC signaling relay
 * - Timer synchronization
 * - Transcription session management
 */

// Redis key prefixes for presence tracking
const PRESENCE_KEY_PREFIX = "meeting:presence:";
const PRESENCE_TTL_SECONDS = 300; // 5 minutes

/**
 * Get presence data from Redis or fallback to local state
 * @param {string} roomId - Meeting room ID
 * @param {Map} localCache - Local fallback cache
 * @returns {Promise<Array>} Array of users in room
 */
const getRoomPresence = async (roomId, localCache) => {
  try {
    const redis = getRedisClient();
    if (redis && redis.isOpen) {
      const key = `${PRESENCE_KEY_PREFIX}${roomId}`;
      const data = await redis.get(key);
      if (data) {
        return JSON.parse(data);
      }
    }
  } catch (error) {
    console.warn(
      "Redis presence lookup failed, using local cache:",
      error.message,
    );
  }

  // Fallback to local cache
  return localCache.get(roomId) || [];
};

/**
 * Update presence data in Redis and local cache
 * @param {string} roomId - Meeting room ID
 * @param {Array} users - Array of users
 * @param {Map} localCache - Local fallback cache
 */
const updateRoomPresence = async (roomId, users, localCache) => {
  // Update local cache
  if (users.length > 0) {
    localCache.set(roomId, users);
  } else {
    localCache.delete(roomId);
  }

  // Update Redis
  try {
    const redis = getRedisClient();
    if (redis && redis.isOpen) {
      const key = `${PRESENCE_KEY_PREFIX}${roomId}`;
      if (users.length > 0) {
        await redis.setEx(key, PRESENCE_TTL_SECONDS, JSON.stringify(users));
      } else {
        await redis.del(key);
      }
    }
  } catch (error) {
    console.warn("Redis presence update failed:", error.message);
  }
};

/**
 * Remove user from room presence
 * @param {string} roomId - Meeting room ID
 * @param {string} socketId - Socket ID to remove
 * @param {Map} localCache - Local fallback cache
 * @returns {Promise<Array>} Updated users array
 */
const removeUserFromRoom = async (roomId, socketId, localCache) => {
  const users = await getRoomPresence(roomId, localCache);
  const filtered = users.filter((u) => u.socketId !== socketId);
  await updateRoomPresence(roomId, filtered, localCache);
  return filtered;
};

/**
 * Add user to room presence
 * @param {string} roomId - Meeting room ID
 * @param {Object} user - User object to add
 * @param {Map} localCache - Local fallback cache
 * @returns {Promise<Array>} Updated users array
 */
const addUserToRoom = async (roomId, user, localCache) => {
  const users = await getRoomPresence(roomId, localCache);

  // Prevent duplicate entries
  const existing = users.find((u) => u.socketId === user.socketId);
  if (!existing) {
    users.push(user);
  }

  await updateRoomPresence(roomId, users, localCache);
  return users;
};

export default (io) => {
  // Local fallback caches for when Redis is unavailable
  const localUsersInRoom = new Map(); // roomId -> Array of users
  const localSocketToRoom = new Map(); // socketId -> roomId
  const roomTimers = {}; // roomId -> timer state (still local as timers are instance-specific)

  io.on("connection", (socket) => {
    /**
     * Check if user has access to a specific meeting
     * @param {string} meetingId - Meeting ID to check
     * @returns {Promise<boolean>} True if user has access
     */
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

    /**
     * Join a meeting room
     * Handles distributed presence tracking across multiple server instances
     */
    socket.on("join-meeting", async ({ roomId }) => {
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

        // Create user object with socket ID using server-side
        // authenticated data to prevent spoofing
        const user = {
          socketId: socket.id,
          id: socket.userId,
          userId: socket.userId,
          name: socket.user?.name || "Anonymous",
          email: socket.user?.email || "",
          profilePic: socket.user?.profilePic || "",
          role: socket.userRole || "member",
        };

        // Add user to room presence (distributed via Redis)
        const allUsersInRoom = await addUserToRoom(
          roomId,
          user,
          localUsersInRoom,
        );
        localSocketToRoom.set(socket.id, roomId);

        // Join the Socket.IO room (adapter handles cross-instance broadcasting)
        socket.join(roomId);

        // Tell the newly joined user about other users in the room
        const usersInThisRoom = allUsersInRoom.filter(
          (u) => u.socketId !== socket.id,
        );
        socket.emit("all-users", usersInThisRoom);

        // Initialize timer state if it doesn't exist (local state is fine for timers)
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
        // Socket.IO adapter ensures this reaches all instances
        socket.to(roomId).emit("user-joined", user);
        console.log(`User ${socket.id} joined room: ${roomId}`);

        try {
          const { checkIn } =
            await import("../services/meetingAttendanceService.js");
          if (user.email) {
            await checkIn(roomId, user.email, new Date());
          }
        } catch (err) {
          console.error("Auto check-in error:", err.message);
        }
      } catch (error) {
        console.error("Error joining meeting:", error);
        socket.emit("error", { message: "Failed to join meeting" });
      }
    });

    /**
     * WebRTC Signaling: relaying signals between peers
     * Socket.IO adapter ensures signals reach users on any instance
     */
    socket.on("sending-signal", (payload) => {
      try {
        if (
          !payload ||
          !payload.userToSignal ||
          !payload.callerID ||
          !payload.signal
        ) {
          console.warn(
            `[WebRTC] Invalid sending-signal payload from ${socket.id}`,
          );
          return;
        }

        // payload: { userToSignal, callerID, signal }
        io.to(payload.userToSignal).emit("user-joined-signal", {
          signal: payload.signal,
          callerID: payload.callerID,
          userInfo: {
            socketId: socket.id,
            id: socket.userId,
            userId: socket.userId,
            name: socket.user?.name || "Anonymous",
            email: socket.user?.email || "",
            profilePic: socket.user?.profilePic || "",
            role: socket.userRole || "member",
          },
        });
      } catch (error) {
        console.error(
          `[WebRTC] Error in sending-signal from ${socket.id}:`,
          error,
        );
      }
    });

    socket.on("returning-signal", (payload) => {
      try {
        if (!payload || !payload.signal || !payload.callerID) {
          console.warn(
            `[WebRTC] Invalid returning-signal payload from ${socket.id}`,
          );
          return;
        }

        // payload: { signal, callerID }
        io.to(payload.callerID).emit("receiving-returned-signal", {
          signal: payload.signal,
          id: socket.id,
        });
      } catch (error) {
        console.error(
          `[WebRTC] Error in returning-signal from ${socket.id}:`,
          error,
        );
      }
    });

    /**
     * Toggle media state tracking (audio/video/screen)
     * Broadcasts to all users in room across all instances
     */
    socket.on("media-state-changed", ({ roomId, type, enabled }) => {
      socket.to(roomId).emit("user-media-changed", {
        socketId: socket.id,
        type, // 'audio' | 'video' | 'screen'
        enabled,
      });
    });

    /**
     * Handle user disconnection
     * Removes user from distributed presence and notifies all instances
     */
    socket.on("disconnect", async () => {
      console.log("🔴 User disconnected:", socket.id);
      const roomId = localSocketToRoom.get(socket.id);

      if (roomId) {
        // Remove user from distributed presence
        const remainingUsers = await removeUserFromRoom(
          roomId,
          socket.id,
          localUsersInRoom,
        );

        // Clean up timer if room is empty
        if (remainingUsers.length === 0) {
          delete roomTimers[roomId];
          // End transcription session when last user leaves
          streamingTranscriptionService.endSession(roomId);
        }

        // Notify all instances about user leaving
        // Socket.IO adapter ensures this reaches all connected clients
        socket.to(roomId).emit("user-left", socket.id);
        localSocketToRoom.delete(socket.id);

        try {
          const { checkOut } =
            await import("../services/meetingAttendanceService.js");
          if (socket.user?.email) {
            await checkOut(roomId, socket.user.email, new Date());
          }
        } catch (err) {
          console.error("Auto check-out error:", err.message);
        }
      }
    });

    /**
     * Start transcription session for a meeting
     */
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

    /**
     * Stop transcription session for a meeting
     */
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

    /**
     * Process audio data for transcription
     */
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

    /**
     * Breakout Rooms
     */
    socket.on("breakout:join", ({ roomId, breakoutRoomId }) => {
      // Join the specific breakout room socket channel
      socket.join(`breakout-${breakoutRoomId}`);
      // Notify others in the main room that user joined a breakout room
      socket.to(roomId).emit("breakout:user-joined", {
        userId: socket.userId,
        breakoutRoomId,
      });
    });

    socket.on("breakout:leave", ({ roomId, breakoutRoomId }) => {
      socket.leave(`breakout-${breakoutRoomId}`);
      socket
        .to(roomId)
        .emit("breakout:user-left", { userId: socket.userId, breakoutRoomId });
    });

    socket.on("breakout:started", ({ roomId, breakoutRoomId }) => {
      // Notify main room that a breakout room was started
      socket.to(roomId).emit("breakout:started", { breakoutRoomId });
    });

    socket.on("breakout:closed", ({ roomId, breakoutRoomId }) => {
      // Notify main room that a breakout room was closed
      socket.to(roomId).emit("breakout:closed", { breakoutRoomId });
    });

    /**
     * Timer synchronization across all users in a meeting
     * Timer state remains local as it's instance-specific
     */
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

      // Broadcast timer state to all users in room (across all instances)
      io.to(roomId).emit("timer-sync", timer);
    });

    /**
     * Q&A Board Events
     */
    socket.on("qa:submit-question", (payload) => {
      io.to(payload.roomId).emit("qa:question-added", payload.question);
    });

    socket.on("qa:upvote-question", (payload) => {
      io.to(payload.roomId).emit("qa:question-upvoted", {
        questionId: payload.questionId,
        upvotes: payload.upvotes,
      });
    });

    socket.on("qa:status-changed", (payload) => {
      io.to(payload.roomId).emit("qa:question-status-changed", {
        questionId: payload.questionId,
        status: payload.status,
      });
    });

    /**
     * Request current room presence (for debugging/sync)
     */
    socket.on("get-room-presence", async ({ roomId }) => {
      try {
        if (!(await canAccessMeeting(roomId))) {
          socket.emit("error", {
            message: "Forbidden: You don't have access to this meeting",
          });
          return;
        }

        const users = await getRoomPresence(roomId, localUsersInRoom);
        socket.emit("room-presence", { roomId, users });
      } catch (error) {
        console.error("Error getting room presence:", error);
        socket.emit("error", { message: "Failed to get room presence" });
      }
    });
  });
};
