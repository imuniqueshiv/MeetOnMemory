import * as Y from "yjs";
import jwt from "jsonwebtoken";
import { createClient } from "redis";
import {
  loadDocumentState,
  saveDocumentState,
} from "../services/documentService.js";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";

// In-memory registry
//     docRegistry[meetingId] = {
//       ydoc      : Y.Doc,          — Yjs document (source of truth)
//       saveTimer : NodeJS.Timeout, — debounce handle
//     }
const docRegistry = new Map();

// Debounce window in milliseconds before a DB write is triggered
const SAVE_DEBOUNCE_MS = 5000;

// Redis Pub/Sub Synchronization Setup for Horizontal Scaling
const redisUri = process.env.REDIS_URI || process.env.REDIS_URL;
let redisPub = null;
let redisSub = null;
const serverId = Math.random().toString(36).substring(7);
let syncNamespace = null;

if (redisUri) {
  try {
    redisPub = createClient({ url: redisUri });
    redisSub = redisPub.duplicate();

    redisPub.on("error", (err) =>
      console.error("❌ [documentSync] Redis Pub Error:", err.message),
    );
    redisSub.on("error", (err) =>
      console.error("❌ [documentSync] Redis Sub Error:", err.message),
    );

    await Promise.all([redisPub.connect(), redisSub.connect()]);
    console.log("✅ [documentSync] Yjs Redis Pub/Sub sync enabled");

    // Subscribe to global cross-server updates channel
    await redisSub.subscribe("yjs-document-sync-updates", (message) => {
      try {
        const { meetingId, update: updateArray, sender } = JSON.parse(message);
        if (sender === serverId) return; // Ignore own echo updates

        const entry = docRegistry.get(meetingId);
        if (entry) {
          console.log(
            `📡 [documentSync] Applying cross-server update for meeting: ${meetingId}`,
          );
          Y.applyUpdate(entry.ydoc, new Uint8Array(updateArray));

          // Broadcast to local sockets on this instance
          const roomName = `doc:${meetingId}`;
          if (syncNamespace) {
            syncNamespace.to(roomName).emit("sync-update", {
              meetingId,
              update: updateArray,
            });
          }
        }
      } catch (err) {
        console.error(
          "❌ [documentSync] Failed to process Redis sync update:",
          err.message,
        );
      }
    });
  } catch (err) {
    console.warn(
      "⚠️  [documentSync] Redis pub/sub failed to initialize:",
      err.message,
    );
    redisPub = null;
    redisSub = null;
  }
}

// JWT Cookie Auth helper
const parseCookie = (str = "") =>
  str
    .split(";")
    .map((v) => v.split("="))
    .reduce((acc, v) => {
      if (v[0] && v[1] !== undefined) {
        acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
      }
      return acc;
    }, {});

// Debounced save — resets the timer on every new update
const scheduleSave = (meetingId, ydoc) => {
  const entry = docRegistry.get(meetingId);
  if (!entry) return;

  // Clear any existing timer
  if (entry.saveTimer) {
    clearTimeout(entry.saveTimer);
  }

  entry.saveTimer = setTimeout(async () => {
    const stateVector = Y.encodeStateAsUpdate(ydoc);

    // Extract plain-text from the shared "notes" Y.Text instance
    const yText = ydoc.getText("notes");
    const plainText = yText.toString();

    await saveDocumentState(meetingId, stateVector, plainText);
  }, SAVE_DEBOUNCE_MS);
};

// Get or create the Yjs document for a meeting (lazy init)
const getOrCreateDoc = async (meetingId) => {
  if (docRegistry.has(meetingId)) {
    return docRegistry.get(meetingId).ydoc;
  }

  const ydoc = new Y.Doc();

  // Register first so concurrent calls don't create duplicates
  docRegistry.set(meetingId, { ydoc, saveTimer: null });

  // Restore persisted state from MongoDB (if any)
  const savedState = await loadDocumentState(meetingId);
  if (savedState) {
    try {
      Y.applyUpdate(ydoc, savedState);
      console.log(
        `[documentSync] Restored Yjs state for meeting: ${meetingId}`,
      );
    } catch (err) {
      console.error(
        `[documentSync] Failed to apply saved state for ${meetingId}:`,
        err.message,
      );
    }
  }

  return ydoc;
};

// Clean up a document from memory when no clients remain (with race-safety checks)
const cleanupDoc = async (meetingId, syncNs) => {
  const roomName = `doc:${meetingId}`;
  const room = syncNs.adapter.rooms.get(roomName);
  const clientCount = room ? room.size : 0;

  if (clientCount === 0 && docRegistry.has(meetingId)) {
    const entry = docRegistry.get(meetingId);

    // Flush any pending save immediately before releasing from memory
    if (entry.saveTimer) {
      clearTimeout(entry.saveTimer);
      const stateVector = Y.encodeStateAsUpdate(entry.ydoc);
      const plainText = entry.ydoc.getText("notes").toString();
      await saveDocumentState(meetingId, stateVector, plainText);
    }

    // Re-check room size to ensure no new client joined while we were awaiting the DB write
    const currentRoom = syncNs.adapter.rooms.get(roomName);
    const currentClientCount = currentRoom ? currentRoom.size : 0;

    if (currentClientCount === 0) {
      docRegistry.delete(meetingId);
      console.log(`[documentSync] Released Yjs doc from memory: ${meetingId}`);
    } else {
      console.log(
        `[documentSync] Aborted release for ${meetingId} because client joined during save`,
      );
    }
  }
};

// Main export — registers /sync namespace on the Socket.io server
export default (io) => {
  // Create a dedicated namespace for document synchronization
  syncNamespace = io.of("/sync");

  // Auth Middleware — validate JWT cookie on every connection
  syncNamespace.use((socket, next) => {
    try {
      const cookieHeader = socket.request.headers.cookie || "";
      const cookies = parseCookie(cookieHeader);
      const token = cookies.token;

      if (!token) {
        return next(new Error("Authentication error: No token found"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      console.error("[documentSync] Auth error:", err.message);
      return next(new Error("Authentication error"));
    }
  });

  // Connection handler
  syncNamespace.on("connection", (socket) => {
    console.log(
      `[documentSync] Client connected: ${socket.id} | user: ${socket.userId}`,
    );

    let currentMeetingId = null;

    // join-document
    // Client sends: { meetingId: string }
    // Server responds with: { type: "sync-full", update: Uint8Array }
    socket.on("join-document", async ({ meetingId } = {}) => {
      if (!meetingId) {
        socket.emit("doc-error", { message: "meetingId is required" });
        return;
      }

      // Authorization Check: Must be the creator, belong to the same organization, or be a listed participant.
      try {
        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
          socket.emit("doc-error", { message: "Meeting not found" });
          return;
        }

        let isAuthorized = meeting.uploadedBy.toString() === socket.userId;

        if (!isAuthorized) {
          const user = await User.findById(socket.userId);
          if (user) {
            // Check organization match
            if (
              meeting.organization &&
              user.organization &&
              meeting.organization.toString() === user.organization.toString()
            ) {
              isAuthorized = true;
            }
            // Check participants list (by email or name)
            if (
              !isAuthorized &&
              meeting.participants &&
              meeting.participants.length > 0
            ) {
              const matchedParticipant = meeting.participants.find(
                (p) =>
                  p.email && p.email.toLowerCase() === user.email.toLowerCase(),
              );
              if (matchedParticipant) {
                isAuthorized = true;
              }
            }
          }
        }

        if (!isAuthorized) {
          socket.emit("doc-error", {
            message:
              "Unauthorized: You do not have access to this meeting's collaborative notes",
          });
          return;
        }
      } catch (authErr) {
        console.error(
          "[documentSync] Auth verification failed:",
          authErr.message,
        );
        socket.emit("doc-error", { message: "Internal authentication error" });
        return;
      }

      currentMeetingId = meetingId;
      const roomName = `doc:${meetingId}`;

      socket.join(roomName);
      console.log(
        `[documentSync] Socket ${socket.id} joined doc room: ${roomName}`,
      );

      try {
        const ydoc = await getOrCreateDoc(meetingId);

        // Send the full current document state to the newly joined client
        const currentState = Y.encodeStateAsUpdate(ydoc);
        socket.emit("sync-full", { update: currentState });
      } catch (err) {
        console.error(
          `[documentSync] Error joining doc ${meetingId}:`,
          err.message,
        );
        socket.emit("doc-error", { message: "Failed to load document state" });
      }
    });

    // sync-update
    // Client sends: { meetingId: string, update: Uint8Array }
    // Server:
    //       1. Applies update to the server-side Yjs doc (conflict-free)
    //       2. Broadcasts the update to all OTHER clients in the room on this server
    //       3. Publishes update to Redis to sync other servers
    //       4. Schedules a debounced DB save
    socket.on("sync-update", ({ meetingId, update } = {}) => {
      if (!meetingId || !update) return;

      const entry = docRegistry.get(meetingId);
      if (!entry) {
        console.warn(
          `[documentSync] Received update for unknown doc: ${meetingId}`,
        );
        return;
      }

      try {
        // Apply the client's CRDT update to our authoritative server doc
        Y.applyUpdate(entry.ydoc, new Uint8Array(update));

        // Broadcast to everyone else in the same document room on this server
        const roomName = `doc:${meetingId}`;
        socket.to(roomName).emit("sync-update", { meetingId, update });

        // Push to Redis Pub/Sub for horizontal scaling/multi-server sync
        if (redisPub) {
          redisPub
            .publish(
              "yjs-document-sync-updates",
              JSON.stringify({
                meetingId,
                update: Array.from(update),
                sender: serverId,
              }),
            )
            .catch((err) =>
              console.error("❌ Redis Publish Error:", err.message),
            );
        }

        // Schedule a debounced save to MongoDB
        scheduleSave(meetingId, entry.ydoc);
      } catch (err) {
        console.error(
          `[documentSync] Failed to apply update for ${meetingId}:`,
          err.message,
        );
      }
    });

    // cursor-update (optional — real-time cursor presence)
    // Client sends: { meetingId, cursor: { anchor, head, user } }
    socket.on("cursor-update", ({ meetingId, cursor } = {}) => {
      if (!meetingId || !cursor) return;
      const roomName = `doc:${meetingId}`;
      socket.to(roomName).emit("cursor-update", {
        socketId: socket.id,
        userId: socket.userId,
        cursor,
      });
    });

    // Disconnect — clean up if no one is left in the room
    socket.on("disconnect", async () => {
      console.log(`[documentSync] Client disconnected: ${socket.id}`);
      if (currentMeetingId) {
        // Small delay to allow the socket to fully leave the room
        setTimeout(() => cleanupDoc(currentMeetingId, syncNamespace), 500);
      }
    });
  });

  console.log("[documentSync] /sync namespace registered");
  return syncNamespace;
};
