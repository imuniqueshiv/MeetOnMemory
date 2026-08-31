const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mediasoup = require("mediasoup");
const cors = require("cors");
const config = require("./config");
const Room = require("./Room");
const setupSocketHandlers = require("./socketHandlers");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // For dev. In prod, lock this down.
    methods: ["GET", "POST"],
  },
});

const workers = [];
let nextMediasoupWorkerIdx = 0;
const rooms = new Map(); // roomId -> Room instance

async function createWorkers() {
  const { numWorkers } = config.mediasoup;
  console.log(`Starting ${numWorkers} mediasoup workers...`);

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.worker.logLevel,
      logTags: config.mediasoup.worker.logTags,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });

    worker.on("died", () => {
      console.error(
        `mediasoup worker died, exiting in 2 seconds... [pid:${worker.pid}]`,
      );
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
  }
  console.log("Mediasoup workers created successfully");
}

function getMediasoupWorker() {
  const worker = workers[nextMediasoupWorkerIdx];
  if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0;
  return worker;
}

async function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    const worker = getMediasoupWorker();
    room = await Room.create(roomId, worker);
    rooms.set(roomId, room);
    console.log(`Created new room: ${roomId}`);

    room.on("empty", () => {
      console.log(`Room ${roomId} is empty, closing...`);
      rooms.delete(roomId);
    });
  }
  return room;
}

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  setupSocketHandlers(socket, getOrCreateRoom);
});

async function run() {
  await createWorkers();
  server.listen(config.listenPort, config.listenIp, () => {
    console.log(
      `SFU Worker listening on ${config.listenIp}:${config.listenPort}`,
    );
  });
}

run().catch(console.error);
