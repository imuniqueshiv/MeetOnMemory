// client/components/IcebreakerSection.jsx
import React, { useState, useEffect } from "react";

export const IcebreakerSection = ({ socket, roomId }) => {
  const [inputText, setInputText] = useState("");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!socket) return;
    socket.on("icebreaker:sync", (data) => {
      setHistory(data.history);
    });
    return () => socket.off("icebreaker:sync");
  }, [socket]);

  const handleTrigger = () => {
    if (!inputText.trim()) return;
    socket.emit("icebreaker:select", { roomId, text: inputText });
    setInputText("");
  };

  return (
    <div className="icebreaker-section-panel">
      <h3>Icebreaker Hub</h3>
      <div className="trigger-box">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type an icebreaker prompt..."
        />
        <button onClick={handleTrigger}>Push Live</button>
      </div>

      <div className="history-timeline">
        <h4>Past Prompts History</h4>
        {history.length === 0 ? (
          <p>No historical items logged yet.</p>
        ) : (
          <ul>
            {history.map((item, idx) => (
              <li key={idx}>
                <strong>{item.text}</strong>
                <span className="history-reactions">
                  {Object.entries(item.reactions)
                    .map(([em, count]) => `${em}${count}`)
                    .join(" ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
