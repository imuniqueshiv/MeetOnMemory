import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-toastify";

export default function useReactions(roomId, socketRef) {
  const [reactions, setReactions] = useState([]); // Array of { id, emoji, userId, isLocal }
  const [onCooldown, setOnCooldown] = useState(false);
  const reactionCountRef = useRef(0);
  const cooldownTimeoutRef = useRef(null);
  const windowTimeoutRef = useRef(null);

  // Constants
  const MAX_REACTIONS_PER_WINDOW = 5;
  const RATE_LIMIT_WINDOW = 10000;

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    const handleNewReaction = (payload) => {
      const { emoji, userId } = payload;
      const id = Date.now() + Math.random().toString(36).substr(2, 9);

      setReactions((prev) => [...prev, { id, emoji, userId }]);

      // Auto-remove reaction from UI after animation completes (e.g. 4 seconds)
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 4000);
    };

    const handleError = (error) => {
      toast.error(error.message || "Failed to send reaction");
      setOnCooldown(true);
      if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = setTimeout(() => {
        setOnCooldown(false);
        reactionCountRef.current = 0;
      }, RATE_LIMIT_WINDOW);
    };

    socket.on("reaction:new", handleNewReaction);
    socket.on("reaction:error", handleError);

    return () => {
      socket.off("reaction:new", handleNewReaction);
      socket.off("reaction:error", handleError);
    };
  }, [socketRef]);

  const sendReaction = useCallback(
    (emoji) => {
      if (onCooldown) {
        toast.warning("You are sending reactions too fast!");
        return;
      }

      // Optimistic UI update
      const id = Date.now() + Math.random().toString(36).substr(2, 9);
      setReactions((prev) => [...prev, { id, emoji, isLocal: true }]);

      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 4000);

      const socket = socketRef?.current;
      if (socket) {
        socket.emit("reaction:send", { roomId, emoji });
      }

      // Client-side rate limiting tracker
      reactionCountRef.current += 1;
      if (reactionCountRef.current >= MAX_REACTIONS_PER_WINDOW) {
        setOnCooldown(true);

        if (cooldownTimeoutRef.current)
          clearTimeout(cooldownTimeoutRef.current);
        if (windowTimeoutRef.current) clearTimeout(windowTimeoutRef.current);

        cooldownTimeoutRef.current = setTimeout(() => {
          setOnCooldown(false);
          reactionCountRef.current = 0;
        }, RATE_LIMIT_WINDOW);
      } else {
        if (!windowTimeoutRef.current) {
          windowTimeoutRef.current = setTimeout(() => {
            reactionCountRef.current = 0;
            windowTimeoutRef.current = null;
          }, RATE_LIMIT_WINDOW);
        }
      }
    },
    [roomId, socketRef, onCooldown],
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
      if (windowTimeoutRef.current) clearTimeout(windowTimeoutRef.current);
    };
  }, []);

  return { reactions, sendReaction, onCooldown };
}
