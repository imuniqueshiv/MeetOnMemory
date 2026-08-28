// client/components/ConvertToAsyncModal.jsx
import React, { useState } from "react";

export const ConvertToAsyncModal = ({
  meetingId,
  currentAttendees,
  isOpen,
  onClose,
  onConversionSuccess,
}) => {
  const [deadline, setDeadline] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleConvert = async () => {
    setErrorMsg("");

    // Front-End Verification Gates
    if (!deadline || new Date(deadline) <= new Date()) {
      setErrorMsg("Target deadline must be positioned in the future.");
      return;
    }
    if (!currentAttendees || currentAttendees.length === 0) {
      setErrorMsg(
        "This meeting possesses no eligible participants to migrate.",
      );
      return;
    }

    const response = await fetch(`/api/async-meetings/${meetingId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deadline, attendees: currentAttendees }),
    });

    const result = await response.json();
    if (response.ok && result.success) {
      onConversionSuccess(result.data);
      onClose();
    } else {
      setErrorMsg(result.error || "Conversion pipeline failed.");
    }
  };

  return (
    <div
      className="modal-backdrop-blur"
      style={{
        background: "rgba(0,0,0,0.5)",
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="modal-content-container"
        style={{
          background: "#fff",
          padding: "2rem",
          borderRadius: "8px",
          maxWidth: "450px",
          width: "100%",
        }}
      >
        <h3>🔄 Convert to Asynchronous Workflow</h3>
        <p>
          <small>
            Migrating this live space transfers participants to a structured,
            deadline-enforced submission container.
          </small>
        </p>

        {errorMsg && (
          <div
            className="error-banner"
            style={{ color: "red", marginBottom: "1rem", fontWeight: "bold" }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <div className="form-group" style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Submission Deadline Target:
          </label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div
          className="modal-actions"
          style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}
        >
          <button onClick={onClose} style={{ background: "#ccc" }}>
            Cancel
          </button>
          <button
            onClick={handleConvert}
            style={{ background: "blue", color: "#fff" }}
          >
            Execute Conversion
          </button>
        </div>
      </div>
    </div>
  );
};
