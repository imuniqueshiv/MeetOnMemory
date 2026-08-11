import { Server } from "socket.io";
import { allowedOrigins } from "./corsOptions.js";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import meetingSocket from "../socket/meetingSocket.js";
import documentSync from "../socket/documentSync.js";
import transcriptSocket from "../socket/transcriptSocket.js";
import reactionSocket from "../socket/reactionSocket.js";
import authenticateSocket from "../middleware/socketAuth.js";

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

  // Authenticate main namespace connections once centrally
  io.use(authenticateSocket);

  // REDIS PUB/SUB ADAPTER (Horizontal Scaling)
  // Enables collaborative editing to work across multiple server instances.
  // Gracefully skips if Redis is not configured.
  (async () => {
    const redisUri = process.env.REDIS_URI || process.env.REDIS_URL;
    if (redisUri) {
      try {
        const redisOptions = {
          url: redisUri,
          socket: {
            reconnectStrategy: (retries) => {
              if (retries > 10) {
                console.error(
                  "❌ Redis Adapter: Max connection retries reached",
                );
                return new Error("Max retries reached");
              }
              // exponential backoff
              return Math.min(retries * 100, 3000);
            },
          },
        };

        const pubClient = createClient(redisOptions);
        const subClient = pubClient.duplicate();

        pubClient.on("error", (err) => {
          console.error("❌ Redis Adapter PubClient Error:", err.message);
        });
        subClient.on("error", (err) => {
          console.error("❌ Redis Adapter SubClient Error:", err.message);
        });

        pubClient.on("reconnecting", () =>
          console.log("🔄 Redis Adapter PubClient reconnecting..."),
        );
        subClient.on("reconnecting", () =>
          console.log("🔄 Redis Adapter SubClient reconnecting..."),
        );

        await Promise.all([pubClient.connect(), subClient.connect()]);

        io.adapter(createAdapter(pubClient, subClient));
        console.log(
          "✅ Socket.io Redis Pub/Sub adapter attached (horizontal scaling enabled for WebRTC Signaling)",
        );
      } catch (err) {
        console.warn(
          "⚠️  Redis adapter failed — running in single-instance mode (WebRTC Signaling may not scale):",
          err.message,
        );
      }
    } else {
      console.log(
        "ℹ️  No REDIS_URI/REDIS_URL set — Socket.io running in single-instance mode (WebRTC Signaling limited to one node)",
      );
    }
  })();

  meetingSocket(io);
  documentSync(io);
  transcriptSocket(io);
  reactionSocket(io);

  return io;
}
