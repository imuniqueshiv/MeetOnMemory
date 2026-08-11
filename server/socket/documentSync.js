import * as Y from "yjs";
import jwt from "jsonwebtoken"; // eslint-disable-line no-unused-vars
import { createClient } from "redis";
import {
  loadDocumentState,
  saveDocumentState,
} from "../services/documentService.js";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import authenticateSocket from "../middleware/socketAuth.js";

// In-memory registry
//     docRegistry[meetingId] = {
//       ydoc      : Y.Doc,          — Yjs document (source of truth)
//       saveTimer : NodeJS.Timeout, — debounce handle
//     }
const docRegistry = new Map();

// Per-room presence registry: roomName -> Map<socketId, { userId, name, email }>
const presenceRegistry = new Map();

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

// ── Real-time presence (Issue #1236) ──────────────────────────────────────────

/**
 * Broadcast the current presence list for a document room to all members.
 * @param {string} roomName - Socket.IO room for the document
 * @param {string} meetingId - Meeting id (included in the payload)
 */
function broadcastPresence(roomName, meetingId) {
  if (!syncNamespace) return;
  const members = presenceRegistry.get(roomName) || new Map();
  const collaborators = Array.from(members.values());
  syncNamespace
    .to(roomName)
    .emit("presence-update", { meetingId, collaborators });
}

/**
 * Register a newly joined socket in the room's presence list and notify the
 * other members. Falls back to the socket's authenticated identity when the
 * User document is unavailable.
 */
function registerPresence(socket, roomName, meetingId) {
  const name =
    socket.user?.name ||
    socket.user?.firstName ||
    socket.user?.username ||
    (socket.userId ? `User ${socket.userId.slice(0, 6)}` : "Anonymous");
  const email = socket.user?.email || "";

  let members = presenceRegistry.get(roomName);
  if (!members) {
    members = new Map();
    presenceRegistry.set(roomName, members);
  }
  members.set(socket.id, {
    socketId: socket.id,
    userId: socket.userId || socket.id,
    name,
    email,
  });

  socket.to(roomName).emit("presence-joined", {
    meetingId,
    collaborator: members.get(socket.id),
  });
  broadcastPresence(roomName, meetingId);
}

/**
 * Remove a socket from the room's presence list and notify remaining members.
 */
function unregisterPresence(socket, roomName, meetingId) {
  const members = presenceRegistry.get(roomName);
  if (!members) return;
  const removed = members.delete(socket.id);
  if (removed) {
    socket
      .to(roomName)
      .emit("presence-left", { meetingId, socketId: socket.id });
  }
  if (members.size === 0) {
    presenceRegistry.delete(roomName);
  } else {
    broadcastPresence(roomName, meetingId);
  }
}

// ── Real-time presence (Issue #1236) ──────────────────────────────────────────

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

/**
 * Replaces a meeting's collaborative notes with `text`, in the CRDT as well as
 * the plain-text column (Issue #1158).
 *
 * `restoreVersion` used to write only `meeting.collaborativeNotes`. Because
 * `getOrCreateDoc` rehydrates from `crdtState`, the next client to open the
 * document reinstated the *pre-restore* text and the debounced save then wrote
 * it back over the restored value. The restore looked correct in the REST
 * response and in any read-only view, then silently reverted.
 *
 * Two cases, both handled here:
 *
 *   - **Live document.** Someone has the notes open, so the authoritative copy
 *     is the in-memory `Y.Doc`, not the database. The replacement is applied
 *     as a Yjs transaction and the resulting update is broadcast to the room
 *     and published to Redis, so connected clients converge on the restored
 *     text instead of overwriting it on their next keystroke.
 *   - **Cold document.** Nobody is connected. A fresh `Y.Doc` seeded with the
 *     text is encoded and returned, so the next `getOrCreateDoc` rehydrates
 *     the restored content.
 *
 * @param {string} meetingId
 * @param {string} text
 * @returns {Promise<{state: Buffer, wasLive: boolean}>} `state` is the encoded
 *   Yjs update the caller should store in `Meeting.crdtState`.
 */
export const restoreCollaborativeNotes = async (meetingId, text = "") => {
  const key = String(meetingId);
  const entry = docRegistry.get(key);

  if (!entry) {
    const ydoc = new Y.Doc();
    if (text) ydoc.getText("notes").insert(0, text);
    return { state: Buffer.from(Y.encodeStateAsUpdate(ydoc)), wasLive: false };
  }

  const { ydoc } = entry;
  const yText = ydoc.getText("notes");

  // Capture the update this transaction produces so it can be shipped to the
  // clients that are already connected. Without it they keep rendering the old
  // text until they reconnect, and their next edit re-applies it.
  let restoreUpdate = null;
  const captureUpdate = (update) => {
    restoreUpdate = update;
  };
  ydoc.on("update", captureUpdate);

  try {
    ydoc.transact(() => {
      if (yText.length > 0) yText.delete(0, yText.length);
      if (text) yText.insert(0, text);
    });
  } finally {
    ydoc.off("update", captureUpdate);
  }

  if (restoreUpdate) {
    const payload = Array.from(restoreUpdate);
    const roomName = `doc:${key}`;

    if (syncNamespace) {
      syncNamespace
        .to(roomName)
        .emit("sync-update", { meetingId: key, update: payload });
    }

    if (redisPub) {
      redisPub
        .publish(
          "yjs-document-sync-updates",
          JSON.stringify({ meetingId: key, update: payload, sender: serverId }),
        )
        .catch((err) =>
          console.error("❌ Redis Publish Error (restore):", err.message),
        );
    }
  }

  // A pending debounced save would write the same state a few seconds later;
  // the caller persists synchronously, so cancel it rather than racing it.
  if (entry.saveTimer) {
    clearTimeout(entry.saveTimer);
    entry.saveTimer = null;
  }

  return { state: Buffer.from(Y.encodeStateAsUpdate(ydoc)), wasLive: true };
};

// Main export — registers /sync namespace on the Socket.io server
export default (io) => {
  // Create a dedicated namespace for document synchronization
  syncNamespace = io.of("/sync");

  // Auth Middleware — Clerk & Dual Auth support
  syncNamespace.use(authenticateSocket);

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

      // Broadcast real-time presence (Issue #1236)
      registerPresence(socket, roomName, meetingId);

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

    // Disconnect — clean up presence and release the doc if no one is left
    socket.on("disconnect", async () => {
      console.log(`[documentSync] Client disconnected: ${socket.id}`);
      if (currentMeetingId) {
        // Notify remaining members and clean up presence (Issue #1236)
        unregisterPresence(socket, `doc:${currentMeetingId}`, currentMeetingId);
        // Small delay to allow the socket to fully leave the room
        setTimeout(() => cleanupDoc(currentMeetingId, syncNamespace), 500);
      }
    });
  });

  console.log("[documentSync] /sync namespace registered");
  return syncNamespace;
};
