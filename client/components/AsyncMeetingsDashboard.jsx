// client/components/AsyncMeetingsDashboard.jsx
import React, { useState } from "react";

export const AsyncMeetingsDashboard = ({ activeMeeting }) => {
  const [responseInput, setResponseInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  if (!activeMeeting) return <p>Loading Asynchronous Portal...</p>;

  const isLocked = new Date() > new Date(activeMeeting.deadline);

  const handlePostResponse = async () => {
    setStatusMessage("");
    const response = await fetch(
      `/api/async-meetings/${activeMeeting.meetingId}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "current_user_id",
          responses: responseInput,
        }),
      },
    );

    const result = await response.json();
    if (response.status === 403) {
      setStatusMessage("❌ Error: Entry blocked. Deadline has expired.");
    } else if (result.success) {
      setStatusMessage("✅ Submission saved successfully!");
      setResponseInput("");
    }
  };

  return (
    <div className="async-dashboard-panel" style={{ padding: "1.5rem" }}>
      <h2>Asynchronous Collaboration Container</h2>
      <div
        className="deadline-tracker"
        style={{
          borderLeft: isLocked ? "4px solid red" : "4px solid green",
          paddingLeft: "1rem",
          background: "#fcfcfc",
        }}
      >
        <p>
          Target Deadline:{" "}
          <strong>{new Date(activeMeeting.deadline).toLocaleString()}</strong>
        </p>
        {isLocked ? (
          <span style={{ color: "red", fontWeight: "bold" }}>
            🔒 Submission Window Locked (Deadline Passed)
          </span>
        ) : (
          <span style={{ color: "green" }}>
            🔓 Open for Participant Contributions
          </span>
        )}
      </div>

      {statusMessage && (
        <p style={{ fontWeight: "bold", marginTop: "10px" }}>{statusMessage}</p>
      )}

      <div className="workspace-entry" style={{ marginTop: "1.5rem" }}>
        <textarea
          value={responseInput}
          onChange={(e) => setResponseInput(e.target.value)}
          disabled={isLocked}
          placeholder={
            isLocked
              ? "Contributions are no longer accepted."
              : "Provide your asynchronous status updates or review comments..."
          }
          style={{
            width: "100%",
            height: "120px",
            display: "block",
            marginBottom: "10px",
          }}
        />
        <button
          onClick={handlePostResponse}
          disabled={isLocked || !responseInput.trim()}
        >
          Push Contribution
        </button>
      </div>
    </div>
  );
};
