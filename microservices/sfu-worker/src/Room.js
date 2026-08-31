const EventEmitter = require("events");
const config = require("./config");

class Room extends EventEmitter {
  constructor(roomId, worker, router) {
    super();
    this.roomId = roomId;
    this.worker = worker;
    this.router = router;

    // Map of peers in the room
    this.peers = new Map(); // socketId -> { socketId, userId, transports: Map, producers: Map, consumers: Map }
  }

  static async create(roomId, worker) {
    const { mediaCodecs } = config.mediasoup.router;
    const router = await worker.createRouter({ mediaCodecs });
    return new Room(roomId, worker, router);
  }

  getRtpCapabilities() {
    return this.router.rtpCapabilities;
  }

  addPeer(socketId, userId) {
    if (!this.peers.has(socketId)) {
      this.peers.set(socketId, {
        socketId,
        userId,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      });
    }
  }

  getPeer(socketId) {
    return this.peers.get(socketId);
  }

  async removePeer(socketId) {
    const peer = this.peers.get(socketId);
    if (!peer) return;

    for (const transport of peer.transports.values()) {
      transport.close();
    }
    this.peers.delete(socketId);

    if (this.peers.size === 0) {
      this.router.close();
      this.emit("empty");
    }
  }

  async createWebRtcTransport(socketId) {
    const peer = this.getPeer(socketId);
    if (!peer) throw new Error("Peer not found");

    const {
      listenIps,
      initialAvailableOutgoingBitrate,
      minimumAvailableOutgoingBitrate,
      maxSctpMessageSize,
    } = config.mediasoup.webRtcTransport;

    const transport = await this.router.createWebRtcTransport({
      listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate,
      minimumAvailableOutgoingBitrate,
      enableSctp: true,
      numSctpStreams: { OS: 1024, MIS: 1024 },
      maxSctpMessageSize,
    });

    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed" || dtlsState === "failed") {
        transport.close();
      }
    });

    peer.transports.set(transport.id, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }

  async connectPeerTransport(socketId, transportId, dtlsParameters) {
    const peer = this.getPeer(socketId);
    if (!peer) throw new Error("Peer not found");

    const transport = peer.transports.get(transportId);
    if (!transport) throw new Error("Transport not found");

    await transport.connect({ dtlsParameters });
  }

  async produce(socketId, transportId, kind, rtpParameters, appData) {
    const peer = this.getPeer(socketId);
    if (!peer) throw new Error("Peer not found");

    const transport = peer.transports.get(transportId);
    if (!transport) throw new Error("Transport not found");

    const producer = await transport.produce({ kind, rtpParameters, appData });
    peer.producers.set(producer.id, producer);

    return producer.id;
  }

  async consume(socketId, transportId, producerId, rtpCapabilities) {
    const peer = this.getPeer(socketId);
    if (!peer) throw new Error("Peer not found");

    const transport = peer.transports.get(transportId);
    if (!transport) throw new Error("Transport not found");

    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error("Cannot consume");
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // Must be resumed after client handles it
    });

    peer.consumers.set(consumer.id, consumer);

    consumer.on("transportclose", () => {
      peer.consumers.delete(consumer.id);
    });

    consumer.on("producerclose", () => {
      peer.consumers.delete(consumer.id);
      // Let the client know the producer closed
      consumer.emit("producerclose");
    });

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  async resumeConsumer(socketId, consumerId) {
    const peer = this.getPeer(socketId);
    if (!peer) return;
    const consumer = peer.consumers.get(consumerId);
    if (consumer) await consumer.resume();
  }

  getProducers() {
    const producers = [];
    for (const peer of this.peers.values()) {
      for (const producer of peer.producers.values()) {
        producers.push({
          producerId: producer.id,
          socketId: peer.socketId,
          userId: peer.userId,
          appData: producer.appData,
        });
      }
    }
    return producers;
  }
}

module.exports = Room;
