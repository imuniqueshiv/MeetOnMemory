import { Server } from "socket.io";
import { allowedOrigins } from "./corsOptions.js";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import meetingSocket from "../socket/meetingSocket.js";
import documentSync from "../socket/documentSync.js";
import transcriptSocket from "../socket/transcriptSocket.js";

export function configureSocket(server, app) {
  // SOCKET.IO
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  app.set("io", io);

  // REDIS PUB/SUB ADAPTER (Horizontal Scaling)
  // Enables collaborative editing to work across multiple server instances.
  // Gracefully skips if Redis is not configured.
  (async () => {
    const redisUri = process.env.REDIS_URI || process.env.REDIS_URL;
    if (redisUri) {
      try {
        const pubClient = createClient({ url: redisUri });
        const subClient = pubClient.duplicate();

        pubClient.on("error", (err) => {
          console.error("❌ Redis PubClient Error:", err.message);
        });
        subClient.on("error", (err) => {
          console.error("❌ Redis SubClient Error:", err.message);
        });

        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
        console.log(
          "✅ Socket.io Redis Pub/Sub adapter attached (horizontal scaling enabled)",
        );
      } catch (err) {
        console.warn(
          "⚠️  Redis adapter failed — running in single-instance mode:",
          err.message,
        );
      }
    } else {
      console.log(
        "ℹ️  No REDIS_URI/REDIS_URL set — Socket.io running in single-instance mode",
      );
    }
  })();

  meetingSocket(io);
  documentSync(io);
  transcriptSocket(io);

  return io;
}
