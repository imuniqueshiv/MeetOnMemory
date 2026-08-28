import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import CrdtService from "../services/crdtService.js";
import NotePresence from "../models/NotePresence.js";

// Predefined colors for user cursors to ensure visual distinction
const CURSOR_COLORS = [
  "#FF5630",
  "#FFAB00",
  "#36B37E",
  "#00B8D9",
  "#6554C0",
  "#FF8F73",
  "#FFC400",
  "#57D9A3",
  "#4C9AFF",
  "#8777D9",
];

/**
 * @desc Initializes the Socket.io namespace for collaborative notes.
 * Handles real-time CRDT sync, awareness (presence/cursors), and room management.
 */
const initializeNotesSocket = (io) => {
  const notesNamespace = io.of("/notes");

  // Authentication middleware for Socket.io connections
  notesNamespace.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(" ")[1];
      if (!token)
        return next(new Error("Authentication error: No token provided"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("name email role");
      if (!user) return next(new Error("Authentication error: User not found"));

      socket.user = user;
      next();
    } catch (_) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  notesNamespace.on("connection", async (socket) => {
    console.log(`[NotesSocket] User ${socket.user.name} connected`);
    let currentMeetingId = null;

    /**
     * @event join-meeting
     * @desc Client joins a specific meeting room to receive CRDT and awareness updates.
     */
    socket.on("join-meeting", async ({ meetingId }, callback) => {
      try {
        currentMeetingId = meetingId;
        const roomName = `meeting:${meetingId}`;

        // Join the Socket.io room
        socket.join(roomName);

        // Assign a deterministic color based on user ID hash
        const colorIndex = socket.user.id.charCodeAt(0) % CURSOR_COLORS.length;
        const userColor = CURSOR_COLORS[colorIndex];

        // Save presence to DB (with TTL)
        await NotePresence.findOneAndUpdate(
          { noteId: meetingId, userId: socket.user.id },
          {
            userName: socket.user.name,
            userColor,
            lastSeen: new Date(),
          },
          { upsert: true, new: true },
        );

        // Fetch current document state to send to the joining client
        const stateVector = await CrdtService.getStateVector(meetingId);

        // Broadcast to others that a new user joined
        socket.to(roomName).emit("user-joined", {
          userId: socket.user.id,
          userName: socket.user.name,
          color: userColor,
        });

        // Fetch all active presences in this room
        const activeUsers = await NotePresence.find({ noteId: meetingId });

        // Send initial state to the joining client
        if (callback) {
          callback({
            success: true,
            stateVector: Array.from(stateVector),
            activeUsers,
            userColor,
          });
        }
      } catch (error) {
        console.error("[NotesSocket] Error joining meeting:", error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * @event sync-update
     * @desc Receives a binary CRDT update from a client, applies it to the server doc,
     * and broadcasts it to all other clients in the room.
     */
    socket.on("sync-update", async ({ meetingId, update }, callback) => {
      try {
        const uint8Update = new Uint8Array(update);

        // Apply to server-side Yjs doc and persist
        await CrdtService.applyUpdate(meetingId, uint8Update, socket.user.id);

        // Broadcast to all OTHER clients in the room
        socket.to(`meeting:${meetingId}`).emit("remote-update", {
          update: Array.from(uint8Update),
          userId: socket.user.id,
        });

        if (typeof callback === "function") {
          callback({ success: true });
        }
      } catch (error) {
        console.error("[NotesSocket] Error applying update:", error);
        if (typeof callback === "function") {
          callback({ success: false, error: error.message });
        }
      }
    });

    /**
     * @event awareness-update
     * @desc Handles cursor position and selection range updates.
     * Throttled on the client side (50ms), but we broadcast immediately here.
     */
    socket.on("awareness-update", async ({ meetingId, cursor }) => {
      try {
        // Update DB presence timestamp to keep TTL alive
        await NotePresence.updateOne(
          { noteId: meetingId, userId: socket.user.id },
          { cursorPosition: cursor, lastSeen: new Date() },
        );

        // Broadcast cursor position to others
        socket.to(`meeting:${meetingId}`).emit("remote-awareness", {
          userId: socket.user.id,
          userName: socket.user.name,
          cursor,
        });
      } catch (_) {
        // Silently fail awareness updates to prevent console spam
      }
    });

    /**
     * @event save-snapshot
     * @desc Manually trigger a version snapshot.
     */
    socket.on("save-snapshot", async ({ meetingId, title }, callback) => {
      try {
        const snapshot = await CrdtService.createSnapshot(
          meetingId,
          socket.user.id,
          title,
        );

        // Notify all clients in the room that a new version was saved
        notesNamespace.to(`meeting:${meetingId}`).emit("snapshot-created", {
          version: snapshot.version,
          createdBy: socket.user.name,
          createdAt: new Date(),
          title,
        });

        if (callback) callback({ success: true, snapshot });
      } catch (error) {
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * @event disconnect
     * @desc Clean up presence when a user disconnects.
     */
    socket.on("disconnect", async () => {
      console.log(`[NotesSocket] User ${socket.user.name} disconnected`);
      if (currentMeetingId) {
        // Remove from DB (TTL will also catch it eventually, but immediate is better)
        await NotePresence.deleteOne({
          noteId: currentMeetingId,
          userId: socket.user.id,
        });

        // Notify others
        socket.to(`meeting:${currentMeetingId}`).emit("user-left", {
          userId: socket.user.id,
        });
      }
    });
  });
};

export default initializeNotesSocket;
