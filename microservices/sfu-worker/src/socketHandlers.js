module.exports = function setupSocketHandlers(socket, getOrCreateRoom) {
  let currentRoomId = null;

  socket.on("joinRoom", async ({ roomId, userId }, callback) => {
    try {
      currentRoomId = roomId;
      const room = await getOrCreateRoom(roomId);
      room.addPeer(socket.id, userId);
      socket.join(roomId);

      const rtpCapabilities = room.getRtpCapabilities();
      callback({ rtpCapabilities });
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });

  socket.on("createWebRtcTransport", async (_, callback) => {
    try {
      if (!currentRoomId) throw new Error("Not in a room");
      const room = await getOrCreateRoom(currentRoomId);
      const transportParams = await room.createWebRtcTransport(socket.id);
      callback(transportParams);
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });

  socket.on(
    "connectWebRtcTransport",
    async ({ transportId, dtlsParameters }, callback) => {
      try {
        if (!currentRoomId) throw new Error("Not in a room");
        const room = await getOrCreateRoom(currentRoomId);
        await room.connectPeerTransport(socket.id, transportId, dtlsParameters);
        callback({ connected: true });
      } catch (err) {
        console.error(err);
        callback({ error: err.message });
      }
    },
  );

  socket.on(
    "produce",
    async ({ transportId, kind, rtpParameters, appData }, callback) => {
      try {
        if (!currentRoomId) throw new Error("Not in a room");
        const room = await getOrCreateRoom(currentRoomId);
        const producerId = await room.produce(
          socket.id,
          transportId,
          kind,
          rtpParameters,
          appData,
        );

        // Notify other peers in the room
        socket.to(currentRoomId).emit("newProducer", {
          producerId,
          socketId: socket.id,
          appData,
        });

        callback({ id: producerId });
      } catch (err) {
        console.error(err);
        callback({ error: err.message });
      }
    },
  );

  socket.on(
    "consume",
    async ({ transportId, producerId, rtpCapabilities }, callback) => {
      try {
        if (!currentRoomId) throw new Error("Not in a room");
        const room = await getOrCreateRoom(currentRoomId);
        const consumerParams = await room.consume(
          socket.id,
          transportId,
          producerId,
          rtpCapabilities,
        );
        callback(consumerParams);
      } catch (err) {
        console.error(err);
        callback({ error: err.message });
      }
    },
  );

  socket.on("resumeConsumer", async ({ consumerId }, callback) => {
    try {
      if (!currentRoomId) throw new Error("Not in a room");
      const room = await getOrCreateRoom(currentRoomId);
      await room.resumeConsumer(socket.id, consumerId);
      if (callback) callback({ resumed: true });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: err.message });
    }
  });

  socket.on("getProducers", async (_, callback) => {
    try {
      if (!currentRoomId) throw new Error("Not in a room");
      const room = await getOrCreateRoom(currentRoomId);
      const producers = room
        .getProducers()
        .filter((p) => p.socketId !== socket.id);
      callback({ producers });
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });

  socket.on("disconnect", async () => {
    if (currentRoomId) {
      try {
        const room = await getOrCreateRoom(currentRoomId);
        await room.removePeer(socket.id);
        socket
          .to(currentRoomId)
          .emit("peerDisconnected", { socketId: socket.id });
      } catch (err) {
        console.error(err);
      }
    }
  });
};
