import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Video, Mic, MicOff, PhoneOff } from "lucide-react";

const MeetingRoom = () => {
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [stream, setStream] = useState(null);
  const videoRef = useRef();
  const socket = useRef();

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const joinMeeting = async () => {
    try {
      const userStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoRef.current.srcObject = userStream;
      setStream(userStream);
      setJoined(true);
      socket.current = io(backendUrl);
      socket.current.emit("join-meeting", { roomId: "demo-room" });
    } catch (err) {
      alert("Camera or microphone access denied.");
    }
  };

  const leaveMeeting = () => {
    stream?.getTracks().forEach(track => track.stop());
    socket.current?.disconnect();
    setJoined(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">🎥 MeetOnMemory Live Room</h1>
      {!joined ? (
        <button
          onClick={joinMeeting}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
        >
          Join Meeting
        </button>
      ) : (
        <div className="flex flex-col items-center gap-6">
          <video ref={videoRef} autoPlay playsInline muted className="rounded-xl shadow-lg w-96" />
          <div className="flex gap-4">
            <button
              onClick={() => setMicOn(!micOn)}
              className="p-3 bg-gray-200 rounded-full hover:bg-gray-300"
            >
              {micOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <button
              onClick={leaveMeeting}
              className="p-3 bg-red-600 text-white rounded-full hover:bg-red-700"
            >
              <PhoneOff size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingRoom;
