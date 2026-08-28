import { useEffect, useCallback, useState } from "react";
import { toast } from "react-toastify";

const SIGNAL_LABELS = {
  weeds: "Deep in the weeds",
  move_on: "Let's move on",
  break: "I need a break",
  clarity: "Need more clarity",
};

export default function usePulseCheck(roomId, socket, isHost) {
  const [onCooldown, setOnCooldown] = useState(false);

  useEffect(() => {
    if (!socket || !isHost) return;

    const handleThresholdAlert = ({ signalType, count }) => {
      const label = SIGNAL_LABELS[signalType] || signalType;
      toast(`🔔 ${count} participants signaled: "${label}"`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark", // Using dark theme to make it stand out as a system alert
      });
    };

    socket.on("pulse_threshold_alert", handleThresholdAlert);

    return () => {
      socket.off("pulse_threshold_alert", handleThresholdAlert);
    };
  }, [socket, isHost]);

  const sendSignal = useCallback(
    (signalType) => {
      if (onCooldown) {
        toast.warning("Please wait before sending another signal.");
        return;
      }

      if (socket) {
        socket.emit("send_pulse_signal", { roomId, signalType });
        toast.success(`Signal sent anonymously: ${SIGNAL_LABELS[signalType]}`, {
          position: "bottom-right",
          autoClose: 2000,
          hideProgressBar: true,
        });

        setOnCooldown(true);
        setTimeout(() => {
          setOnCooldown(false);
        }, 15000); // 15 seconds cooldown
      }
    },
    [roomId, socket, onCooldown],
  );

  return { sendSignal, onCooldown };
}
