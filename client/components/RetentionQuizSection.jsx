// client/components/RetentionQuizSection.jsx
import React, { useState, useEffect } from "react";

export const RetentionQuizSection = ({ meetingId, isOrganizer }) => {
  const [questions, setQuestions] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Local Form state for active question edits
  const [qText, setQText] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [correctIdx, setCorrectIdx] = useState(0);

  const fetchQuestions = React.useCallback(async () => {
    // API GET request wrap logic simulation
    setQuestions((q) => q || []);
  }, []);

  const fetchAnalytics = React.useCallback(async () => {
    // API simulation payload mapping logic
    setAnalytics({ passRate: 85, totalAttempts: 20, perQuestionStats: [] });
  }, []);

  useEffect(() => {
    fetchQuestions();
    if (isOrganizer) fetchAnalytics();
  }, [meetingId, isOrganizer, fetchQuestions, fetchAnalytics]);

  const handleAddQuestion = async () => {
    const newQuestion = {
      id: Date.now().toString(),
      questionText: qText,
      options: opts.filter((o) => o.trim() !== ""),
      correctAnswerIndex: parseInt(correctIdx),
    };
    const updated = [...questions, newQuestion];
    setQuestions(updated);

    // Trigger Server Mutation Save Sync
    await fetch(`/api/meetings/${meetingId}/quiz-bank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: updated }),
    });

    setQText("");
    setOpts(["", "", "", ""]);
  };

  return (
    <div className="retention-quiz-container">
      <h2>Retention Quiz Hub</h2>

      {isOrganizer && (
        <div
          className="organizer-dashboard-grid"
          style={{ display: "flex", gap: "2rem" }}
        >
          {/* Question Bank Manager Element */}
          <div className="quiz-bank-editor" style={{ flex: 1 }}>
            <h3>Modify Question Bank</h3>
            <div className="form-group">
              <input
                type="text"
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Enter evaluation query prompt..."
                style={{ width: "100%" }}
              />
              {opts.map((opt, i) => (
                <input
                  key={i}
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const current = [...opts];
                    current[i] = e.target.value;
                    setOpts(current);
                  }}
                  placeholder={`Option choice variant #${i + 1}`}
                />
              ))}
              <select
                value={correctIdx}
                onChange={(e) => setCorrectIdx(e.target.value)}
              >
                {opts.map((_, i) => (
                  <option key={i} value={i}>
                    Correct Option Line #{i + 1}
                  </option>
                ))}
              </select>
              <button onClick={handleAddQuestion} style={{ marginTop: "10px" }}>
                Commit to Bank
              </button>
            </div>

            <h4>Active Bank Records ({questions.length})</h4>
            <ul>
              {questions.map((q, idx) => (
                <li key={q.id}>
                  {idx + 1}. {q.questionText}
                </li>
              ))}
            </ul>
          </div>

          {/* Metrics Visualization Element */}
          {analytics && (
            <div
              className="quiz-analytics-panel"
              style={{ flex: 1, background: "#f5f5f5", padding: "1rem" }}
            >
              <h3>Performance Insights Dashboard</h3>
              <div className="kpi-row">
                <p>
                  <strong>Total Audience Submissions:</strong>{" "}
                  {analytics.totalAttempts}
                </p>
                <p>
                  <strong>Cohort Target Pass Rate:</strong> {analytics.passRate}
                  %
                </p>
              </div>
              <h4>Item Breakdown Accuracy Vector</h4>
              {analytics.perQuestionStats.map((stat, i) => (
                <div key={i} className="stat-row">
                  <small>{stat.questionText}</small>
                  <div
                    style={{
                      background: "#ddd",
                      height: "10px",
                      borderRadius: "4px",
                    }}
                  >
                    <div
                      style={{
                        background: "green",
                        width: `${stat.correctPercentage}%`,
                        height: "100%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isOrganizer && (
        <div className="participant-quiz-view">
          <h3>Active Evaluation Form</h3>
          {questions.length === 0 ? (
            <p>Waiting for the quiz creator to publish questions...</p>
          ) : (
            <p>
              Quiz live. Standard processing container is active for user
              submission passes.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
