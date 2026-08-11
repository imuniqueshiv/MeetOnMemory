import Reaction from "../models/reactionModel.js";

// In-memory rate limiting store: socketId -> { count: number, resetTime: number }
const rateLimitStore = {};
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const MAX_REACTIONS_PER_WINDOW = 5;

const validEmojis = ["👍", "❤️", "😂", "🎉", "🤔", "👏"];

export default (io) => {
  io.on("connection", (socket) => {
    socket.on("reaction:send", async (payload) => {
      try {
        const { roomId, emoji, transcriptSegmentIndex } = payload;

        if (!roomId || !emoji || !validEmojis.includes(emoji)) {
          return;
        }

        // Must be authenticated via the middleware in meetingSocket.js
        if (!socket.userId) {
          return;
        }

        // Rate limiting check
        const now = Date.now();
        if (!rateLimitStore[socket.id]) {
          rateLimitStore[socket.id] = {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW,
          };
        } else {
          const rateData = rateLimitStore[socket.id];
          if (now > rateData.resetTime) {
            rateData.count = 1;
            rateData.resetTime = now + RATE_LIMIT_WINDOW;
          } else {
            if (rateData.count >= MAX_REACTIONS_PER_WINDOW) {
              socket.emit("reaction:error", {
                message: "Rate limit exceeded. Try again later.",
              });
              return;
            }
            rateData.count++;
          }
        }

        // Broadcast to everyone else in the room
        const broadcastPayload = {
          userId: socket.userId,
          emoji,
          timestamp: new Date().toISOString(),
          transcriptSegmentIndex,
        };

        socket.to(roomId).emit("reaction:new", broadcastPayload);

        // Asynchronously save to DB
        await Reaction.create({
          meeting: roomId,
          user: socket.userId,
          emoji,
          timestamp: new Date(),
          transcriptSegmentIndex,
        });
      } catch (error) {
        console.error("Error handling reaction:", error);
      }
    });

    socket.on("disconnect", () => {
      delete rateLimitStore[socket.id];
    });
  });
};
