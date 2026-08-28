// client/components/LiveIcebreakerBanner.jsx
import React, { useState, useEffect } from "react";

export const LiveIcebreakerBanner = ({ socket, roomId }) => {
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [reactions, setReactions] = useState({});

  useEffect(() => {
    if (!socket) return;

    socket.on("icebreaker:sync", (data) => {
      setCurrentPrompt(data.current);
      setReactions(data.reactions);
    });

    socket.on("icebreaker:reaction_update", (data) => {
      setReactions(data.reactions);
    });

    return () => {
      socket.off("icebreaker:sync");
      socket.off("icebreaker:reaction_update");
    };
  }, [socket]);

  const sendReaction = (emoji) => {
    socket.emit("icebreaker:react", { roomId, emoji });
  };

  if (!currentPrompt) return null;

  return (
    <div className="live-icebreaker-banner-alert">
      <div className="prompt-display-area">
        <span>💬 Active Icebreaker:</span>
        <h2>{currentPrompt}</h2>
      </div>
      <div className="reaction-action-bar">
        {Object.entries(reactions).map(([emoji, count]) => (
          <button key={emoji} onClick={() => sendReaction(emoji)}>
            {emoji} <span className="badge-count">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
