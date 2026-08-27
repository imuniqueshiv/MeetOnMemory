// client/components/MinutesApproval.jsx
import React, { useState, useEffect } from "react";

export const MinutesApproval = ({ minutesId, userRole, userId }) => {
  const [minutesData, setMinutesData] = useState(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    fetchMinutesState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutesId]);

  const fetchMinutesState = async () => {
    // Local API mapping wrapper simulation
    setMinutesData(
      minutesData || { status: "PENDING", quorumTarget: 3, votes: {} },
    );
  };

  const submitAction = async (actionType) => {
    const response = await fetch(`/api/minutes/${minutesId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        role: userRole,
        action: actionType,
        feedback,
      }),
    });

    if (response.status === 403) {
      alert("Error: You are not authorized to approve minutes.");
      return;
    }

    const result = await response.json();
    if (result.success) {
      setMinutesData(result.data);
      setFeedback("");
    }
  };

  if (!minutesData) return <p>Loading MoM Governance Workspace...</p>;

  const currentApprovals = Object.values(minutesData.votes || {}).filter(
    (v) => v === "APPROVE",
  ).length;

  return (
    <div
      className="minutes-approval-box"
      style={{ padding: "1.5rem", border: "1px solid #ccc" }}
    >
      <h2>Minutes of Meeting (MoM) Sign-off Guard</h2>

      {/* Quorum Progress Tracker Container */}
      <div
        className="quorum-status-banner"
        style={{ background: "#f9f9f9", padding: "1rem", marginBottom: "1rem" }}
      >
        <h4>
          Current Status:{" "}
          <span
            style={{
              color: minutesData.status === "APPROVED" ? "green" : "orange",
            }}
          >
            {minutesData.status}
          </span>
        </h4>
        <p>
          Approval Progress: <strong>{currentApprovals}</strong> /{" "}
          {minutesData.quorumTarget} members signed off
        </p>
        <div
          style={{
            background: "#eee",
            width: "100%",
            height: "8px",
            borderRadius: "4px",
          }}
        >
          <div
            style={{
              background: "blue",
              width: `${Math.min((currentApprovals / minutesData.quorumTarget) * 100, 100)}%`,
              height: "100%",
            }}
          />
        </div>
      </div>

      {/* Action Input Elements */}
      <div className="action-control-group">
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Add amendment notes or change requirements details here..."
          style={{ width: "100%", height: "80px", marginBottom: "10px" }}
        />
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={() => submitAction("APPROVE")}
            style={{ background: "green", color: "#fff" }}
          >
            Sign & Approve
          </button>
          <button
            onClick={() => submitAction("REQUEST_CHANGES")}
            style={{ background: "red", color: "#fff" }}
          >
            Request Changes
          </button>

          {/* Download Audit Trail Hook */}
          <a
            href={`/api/minutes/${minutesId}/export-audit`}
            download
            className="download-audit-btn"
            style={{
              marginLeft: "auto",
              textDecoration: "underline",
              alignSelf: "center",
            }}
          >
            📥 Download Audit Trail
          </a>
        </div>
      </div>
    </div>
  );
};
