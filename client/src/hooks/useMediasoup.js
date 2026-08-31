import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";

export function useMediasoup(roomId, userId) {
  const [isConnected, setIsConnected] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]); // Array of { socketId, stream }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoHidden, setIsVideoHidden] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef(new Map());
  const consumersRef = useRef(new Map());
  const remoteStreamsMapRef = useRef(new Map()); // socketId -> MediaStream

  useEffect(() => {
    if (!roomId || !userId) return;

    const socket = io(import.meta.env.VITE_SFU_URL || "http://localhost:4001");
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit(
        "joinRoom",
        { roomId, userId },
        async ({ rtpCapabilities, error }) => {
          if (error) return setError(error);
          await initDevice(rtpCapabilities);
          await createTransports();
          await fetchProducers();
        },
      );
    });

    socket.on("newProducer", async ({ producerId, socketId, appData }) => {
      await consumeRemoteTrack(producerId, socketId, appData);
    });

    socket.on("peerDisconnected", ({ socketId }) => {
      remoteStreamsMapRef.current.delete(socketId);
      updateRemoteStreamsState();
    });

    socket.on("disconnect", () => setIsConnected(false));

    const producers = producersRef.current;
    const consumers = consumersRef.current;

    return () => {
      socket.disconnect();
      producers.forEach((p) => p.close());
      consumers.forEach((c) => c.close());
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId]);

  const initDevice = async (routerRtpCapabilities) => {
    try {
      const device = new Device();
      await device.load({ routerRtpCapabilities });
      deviceRef.current = device;
    } catch (err) {
      setError(err.message);
    }
  };

  const createTransports = async () => {
    const socket = socketRef.current;
    const device = deviceRef.current;

    // Send Transport
    const sendTransportParams = await emitPromise(
      socket,
      "createWebRtcTransport",
    );
    const sendTransport = device.createSendTransport(sendTransportParams);

    sendTransport.on(
      "connect",
      async ({ dtlsParameters }, callback, errback) => {
        try {
          await emitPromise(socket, "connectWebRtcTransport", {
            transportId: sendTransport.id,
            dtlsParameters,
          });
          callback();
        } catch (err) {
          errback(err);
        }
      },
    );

    sendTransport.on(
      "produce",
      async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
          const { id } = await emitPromise(socket, "produce", {
            transportId: sendTransport.id,
            kind,
            rtpParameters,
            appData,
          });
          callback({ id });
        } catch (err) {
          errback(err);
        }
      },
    );

    sendTransportRef.current = sendTransport;

    // Recv Transport
    const recvTransportParams = await emitPromise(
      socket,
      "createWebRtcTransport",
    );
    const recvTransport = device.createRecvTransport(recvTransportParams);

    recvTransport.on(
      "connect",
      async ({ dtlsParameters }, callback, errback) => {
        try {
          await emitPromise(socket, "connectWebRtcTransport", {
            transportId: recvTransport.id,
            dtlsParameters,
          });
          callback();
        } catch (err) {
          errback(err);
        }
      },
    );

    recvTransportRef.current = recvTransport;
  };

  const fetchProducers = async () => {
    const socket = socketRef.current;
    const { producers } = await emitPromise(socket, "getProducers");
    for (const p of producers) {
      await consumeRemoteTrack(p.producerId, p.socketId);
    }
  };

  const consumeRemoteTrack = async (producerId, socketId) => {
    try {
      const socket = socketRef.current;
      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;

      const consumerParams = await emitPromise(socket, "consume", {
        transportId: recvTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      });

      const consumer = await recvTransport.consume(consumerParams);
      consumersRef.current.set(consumer.id, consumer);

      let stream = remoteStreamsMapRef.current.get(socketId);
      if (!stream) {
        stream = new MediaStream();
        remoteStreamsMapRef.current.set(socketId, stream);
      }
      stream.addTrack(consumer.track);

      updateRemoteStreamsState();

      await emitPromise(socket, "resumeConsumer", { consumerId: consumer.id });
    } catch (err) {
      console.error("Error consuming track", err);
    }
  };

  const updateRemoteStreamsState = () => {
    const streamsArray = Array.from(remoteStreamsMapRef.current.entries()).map(
      ([sockId, stream]) => ({
        socketId: sockId,
        stream,
      }),
    );
    setRemoteStreams(streamsArray);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setLocalStream(stream);

      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      if (audioTrack) {
        const audioProducer = await sendTransportRef.current.produce({
          track: audioTrack,
          appData: { type: "mic" },
        });
        producersRef.current.set("audio", audioProducer);
      }
      if (videoTrack) {
        const videoProducer = await sendTransportRef.current.produce({
          track: videoTrack,
          appData: { type: "camera" },
        });
        producersRef.current.set("video", videoProducer);
      }
    } catch (err) {
      setError("Could not access camera/mic: " + err.message);
    }
  };

  const toggleMic = () => {
    const producer = producersRef.current.get("audio");
    if (producer) {
      if (isMuted) producer.resume();
      else producer.pause();
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    const producer = producersRef.current.get("video");
    if (producer) {
      if (isVideoHidden) producer.resume();
      else producer.pause();
      setIsVideoHidden(!isVideoHidden);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      const producer = producersRef.current.get("screen");
      if (producer) {
        producer.close();
        producersRef.current.delete("screen");
      }
      setIsScreenSharing(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const track = stream.getVideoTracks()[0];

      track.onended = () => toggleScreenShare();

      const producer = await sendTransportRef.current.produce({
        track,
        appData: { type: "screen" },
      });
      producersRef.current.set("screen", producer);
      setIsScreenSharing(true);
    } catch (err) {
      setError("Could not share screen: " + err.message);
    }
  };

  return {
    isConnected,
    localStream,
    remoteStreams,
    isMuted,
    isVideoHidden,
    isScreenSharing,
    error,
    startCamera,
    toggleMic,
    toggleVideo,
    toggleScreenShare,
  };
}

// Helper for socket emit with promise
function emitPromise(socket, event, data = {}) {
  return new Promise((resolve, reject) => {
    socket.emit(event, data, (response) => {
      if (response && response.error) reject(new Error(response.error));
      else resolve(response);
    });
  });
}
