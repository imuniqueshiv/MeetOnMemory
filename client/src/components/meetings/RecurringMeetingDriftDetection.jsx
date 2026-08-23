// src/components/meeting/RecurringMeetingDriftDetection.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

const RecurringMeetingDriftDetection = ({
  meetingId,
  recurrencePattern,
  participants = [],
  onDriftDetected,
  onScheduleUpdate,
  initialDriftHistory = [],
}) => {
  const [driftHistory, setDriftHistory] = useState(initialDriftHistory);
  const [currentDrift, setCurrentDrift] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDrift, setSelectedDrift] = useState(null);
  const [analysisMode, setAnalysisMode] = useState('auto');

  useEffect(() => {
    const fetchDriftHistory = async () => {
      if (!meetingId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/meetings/${meetingId}/drift-history`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch drift history');
        }

        const data = await response.json();
        setDriftHistory(data.history || []);
        
        if (data.currentDrift) {
          setCurrentDrift(data.currentDrift);
        }
      } catch (err) {
        setError(err.message);
        console.error('Drift history fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDriftHistory();
  }, [meetingId]);

  useEffect(() => {
    const analyzeDrift = async () => {
      if (!meetingId || !recurrencePattern) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/meetings/${meetingId}/drift-analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recurrencePattern,
            participants: participants.map((p) => p.email),
            analysisMode,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to analyze meeting drift');
        }

        const data = await response.json();
        
        const driftEntry = {
          id: data.id || Date.now().toString(),
          timestamp: new Date().toISOString(),
          ...data,
          detectedAt: new Date().toISOString(),
        };

        setCurrentDrift(driftEntry);
        setDriftHistory((prev) => [driftEntry, ...prev]);

        if (onDriftDetected) {
          onDriftDetected(driftEntry);
        }

        if (data.driftSeverity === 'high' || data.driftSeverity === 'critical') {
          setSelectedDrift(driftEntry);
        }
      } catch (err) {
        setError(err.message);
        console.error('Drift analysis error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (meetingId && recurrencePattern) {
      analyzeDrift();
    }
  }, [meetingId, recurrencePattern, participants, analysisMode, onDriftDetected]);

  const handleReschedule = useCallback(
    async (driftId, newSchedule) => {
      try {
        const response = await fetch(`/api/meetings/${meetingId}/reschedule`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            driftId,
            ...newSchedule,
            participants: participants.map((p) => p.email),
            rescheduledAt: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to reschedule meeting');
        }

        const updatedMeeting = await response.json();

        const updatedDrift = {
          ...currentDrift,
          resolved: true,
          resolvedAt: new Date().toISOString(),
          resolution: 'rescheduled',
          newSchedule: newSchedule,
        };

        setCurrentDrift(updatedDrift);
        setDriftHistory((prev) =>
          prev.map((d) => (d.id === driftId ? updatedDrift : d))
        );

        if (onScheduleUpdate) {
          onScheduleUpdate(updatedMeeting);
        }

        setSelectedDrift(null);
        setShowHistory(false);

        return updatedMeeting;
      } catch (err) {
        setError(err.message);
        console.error('Reschedule error:', err);
        throw err;
      }
    },
    [meetingId, participants, currentDrift, onScheduleUpdate]
  );

  const handleIgnoreDrift = useCallback(
    async (driftId) => {
      try {
        const response = await fetch(`/api/meetings/${meetingId}/drift/${driftId}/ignore`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ignoredAt: new Date().toISOString(),
            ignoredBy: 'Current User',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to ignore drift');
        }

        const updatedDrift = {
          ...currentDrift,
          ignored: true,
          ignoredAt: new Date().toISOString(),
        };

        setCurrentDrift(updatedDrift);
        setDriftHistory((prev) =>
          prev.map((d) => (d.id === driftId ? updatedDrift : d))
        );

        setSelectedDrift(null);
      } catch (err) {
        setError(err.message);
        console.error('Ignore drift error:', err);
        throw err;
      }
    },
    [currentDrift, meetingId]
  );

  const sortedDriftHistory = useMemo(() => {
    return [...driftHistory].sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }, [driftHistory]);

  const getSeverityColor = (severity) => {
    const colors = {
      low: '#81c784',
      moderate: '#ffb74d',
      high: '#e57373',
      critical: '#d32f2f',
    };
    return colors[severity] || colors.low;
  };

  const getSeverityLabel = (severity) => {
    const labels = {
      low: 'Low Drift',
      moderate: 'Moderate Drift',
      high: 'High Drift',
      critical: 'Critical Drift',
    };
    return labels[severity] || severity;
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      low: '📊',
      moderate: '⚠️',
      high: '🚨',
      critical: '🔥',
    };
    return icons[severity] || '📌';
  };

  const getStatusBadge = (drift) => {
    if (drift.resolved) {
      return <span className="badge resolved">✅ Resolved</span>;
    }
    if (drift.ignored) {
      return <span className="badge ignored">⏭️ Ignored</span>;
    }
    if (drift.driftSeverity === 'critical' || drift.driftSeverity === 'high') {
      return <span className="badge alert">🔴 Needs Action</span>;
    }
    return <span className="badge monitoring">👁️ Monitoring</span>;
  };

  const renderDriftEntry = (drift, isCurrent = false) => {
    const {
      id,
      timestamp,
      driftAmount,
      driftPercentage,
      originalSchedule,
      currentSchedule,
      driftSeverity,
      affectedParticipants,
      recommendations,
      resolved,
      resolvedAt,
      resolution,
      ignored,
    } = drift;

    return (
      <div
        key={id}
        className={`drift-entry ${isCurrent ? 'current' : ''} ${
          resolved ? 'resolved' : ''
        } ${ignored ? 'ignored' : ''}`}
        onClick={() => setSelectedDrift(drift)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setSelectedDrift(drift);
          }
        }}
      >
        <div className="drift-entry-header">
          <div className="drift-entry-icons">
            <span className="severity-icon">{getSeverityIcon(driftSeverity)}</span>
            {isCurrent && <span className="current-badge">Current</span>}
          </div>
          <div className="drift-entry-meta">
            <span
              className="severity-badge"
              style={{
                backgroundColor: getSeverityColor(driftSeverity),
              }}
            >
              {getSeverityLabel(driftSeverity)}
            </span>
            <span className="drift-amount">{driftAmount} min drift</span>
            <span className="drift-percentage">{driftPercentage}%</span>
          </div>
          {getStatusBadge(drift)}
        </div>

        <div className="drift-entry-details">
          <div className="schedule-compare">
            <div className="schedule-item original">
              <span className="schedule-label">Original:</span>
              <span className="schedule-time">
                {new Date(originalSchedule?.startDate).toLocaleString()}
              </span>
            </div>
            <div className="drift-arrow">→</div>
            <div className="schedule-item current">
              <span className="schedule-label">Current:</span>
              <span className="schedule-time">
                {new Date(currentSchedule?.startDate).toLocaleString()}
              </span>
            </div>
          </div>

          {affectedParticipants && affectedParticipants.length > 0 && (
            <div className="affected-count">
              <span>👥 {affectedParticipants.length} participants affected</span>
            </div>
          )}
        </div>

        <div className="drift-entry-footer">
          <span className="drift-timestamp">
            Detected: {new Date(timestamp).toLocaleString()}
          </span>
          {resolved && (
            <span className="resolution-info">
              Resolved: {new Date(resolvedAt).toLocaleString()}
            </span>
          )}
          {ignored && (
            <span className="ignored-info">Ignored</span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="drift-detection-loading">
        <div className="spinner" />
        <p>Analyzing meeting patterns for drift...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="drift-detection-error">
        <div className="error-icon">⚠️</div>
        <h3>Unable to analyze meeting drift</h3>
        <p>{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="retry-button"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!currentDrift && driftHistory.length === 0) {
    return (
      <div className="drift-detection-empty">
        <div className="empty-icon">📊</div>
        <h3>No drift data available</h3>
        <p>Start your recurring meeting to begin tracking patterns.</p>
        <button
          type="button"
          className="analyze-button"
          onClick={() => {
            setAnalysisMode('manual');
            const event = new Event('change');
            document.dispatchEvent(event);
          }}
        >
          Analyze Now
        </button>
      </div>
    );
  }

  return (
    <div className="recurring-meeting-drift-detection">
      <div className="drift-header">
        <h3>Recurring Meeting Drift Detection</h3>
        <div className="drift-controls">
          <select
            value={analysisMode}
            onChange={(e) => setAnalysisMode(e.target.value)}
            className="mode-selector"
          >
            <option value="auto">Auto Analysis</option>
            <option value="manual">Manual Analysis</option>
            <option value="deep">Deep Analysis</option>
          </select>
          <button
            type="button"
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide History' : `View History (${driftHistory.length})`}
          </button>
          <button
            type="button"
            className="refresh-button"
            onClick={() => {
              setAnalysisMode(analysisMode === 'auto' ? 'deep' : 'auto');
              const event = new Event('change');
              document.dispatchEvent(event);
            }}
          >
            🔄
          </button>
        </div>
      </div>

      {currentDrift && !showHistory && (
        <div className="current-drift-container">
          <div className="current-drift-header">
            <h4>Current Drift Status</h4>
            <div className="drift-status-indicator">
              <div
                className="status-dot"
                style={{
                  backgroundColor: getSeverityColor(currentDrift.driftSeverity),
                  animation:
                    currentDrift.driftSeverity === 'critical' ||
                    currentDrift.driftSeverity === 'high'
                      ? 'pulse 1s infinite'
                      : 'none',
                }}
              />
              <span className="status-text">
                {getSeverityLabel(currentDrift.driftSeverity)}
              </span>
              {currentDrift.driftAmount && (
                <span className="drift-amount-badge">
                  {currentDrift.driftAmount} min
                </span>
              )}
            </div>
          </div>

          {renderDriftEntry(currentDrift, true)}

          {(currentDrift.driftSeverity === 'high' ||
            currentDrift.driftSeverity === 'critical') && (
            <div className="drift-alert">
              <div className="alert-icon">🚨</div>
              <div className="alert-message">
                <strong>Significant drift detected!</strong>
                <p>
                  The recurring meeting has drifted by {currentDrift.driftAmount} minutes
                  from its original schedule. Immediate action recommended.
                </p>
                {currentDrift.recommendations && (
                  <ul className="recommendations-list">
                    {currentDrift.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="alert-actions">
                <button
                  type="button"
                  className="action-button primary"
                  onClick={() => setSelectedDrift(currentDrift)}
                >
                  Reschedule Now
                </button>
                <button
                  type="button"
                  className="action-button secondary"
                  onClick={() => handleIgnoreDrift(currentDrift.id)}
                >
                  Ignore
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showHistory && (
        <div className="drift-history-container">
          <div className="history-header">
            <h4>Drift Detection History</h4>
            <div className="history-stats">
              <span>Total: {driftHistory.length}</span>
              <span>Resolved: {driftHistory.filter(d => d.resolved).length}</span>
              <span>Active: {driftHistory.filter(d => !d.resolved && !d.ignored).length}</span>
            </div>
          </div>

          <div className="history-timeline">
            {sortedDriftHistory.map((drift) => (
              <div key={drift.id} className="history-item-wrapper">
                <div className="history-timeline-marker">
                  <div
                    className="marker-dot"
                    style={{
                      backgroundColor: getSeverityColor(drift.driftSeverity),
                    }}
                  />
                  {drift.resolved && <div className="marker-line resolved" />}
                  {drift.ignored && <div className="marker-line ignored" />}
                </div>
                <div className="history-item-content">
                  {renderDriftEntry(drift, false)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedDrift && (
        <div className="drift-details-modal">
          <div
            className="modal-overlay"
            onClick={() => setSelectedDrift(null)}
          />
          <div className="modal-content">
            <div className="modal-header">
              <h3>Drift Details</h3>
              <button
                type="button"
                className="close-modal"
                onClick={() => setSelectedDrift(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h4>Drift Summary</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Severity</span>
                    <span
                      className="summary-value"
                      style={{
                        color: getSeverityColor(selectedDrift.driftSeverity),
                      }}
                    >
                      {getSeverityLabel(selectedDrift.driftSeverity)}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Drift Amount</span>
                    <span className="summary-value">
                      {selectedDrift.driftAmount} minutes
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Drift Percentage</span>
                    <span className="summary-value">
                      {selectedDrift.driftPercentage}%
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Detected</span>
                    <span className="summary-value">
                      {new Date(selectedDrift.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Schedule Comparison</h4>
                <div className="schedule-comparison">
                  <div className="schedule-box original">
                    <h5>Original Schedule</h5>
                    <p>
                      Start:{' '}
                      {new Date(
                        selectedDrift.originalSchedule?.startDate
                      ).toLocaleString()}
                    </p>
                    <p>Duration: {selectedDrift.originalSchedule?.duration} min</p>
                    <p>Frequency: {selectedDrift.originalSchedule?.frequency}</p>
                    <p>
                      Interval: Every {selectedDrift.originalSchedule?.interval}{' '}
                      {selectedDrift.originalSchedule?.frequency}
                    </p>
                  </div>
                  <div className="schedule-arrow">⟶</div>
                  <div className="schedule-box current">
                    <h5>Current Schedule</h5>
                    <p>
                      Start:{' '}
                      {new Date(
                        selectedDrift.currentSchedule?.startDate
                      ).toLocaleString()}
                    </p>
                    <p>Duration: {selectedDrift.currentSchedule?.duration} min</p>
                    <p>Frequency: {selectedDrift.currentSchedule?.frequency}</p>
                    <p>
                      Interval: Every {selectedDrift.currentSchedule?.interval}{' '}
                      {selectedDrift.currentSchedule?.frequency}
                    </p>
                  </div>
                </div>
              </div>

              {selectedDrift.affectedParticipants &&
                selectedDrift.affectedParticipants.length > 0 && (
                  <div className="detail-section">
                    <h4>Affected Participants</h4>
                    <div className="participants-grid">
                      {selectedDrift.affectedParticipants.map((p, idx) => (
                        <div key={idx} className="participant-card">
                          <span className="participant-name">{p.name}</span>
                          <span className="participant-email">{p.email}</span>
                          {p.conflicts > 0 && (
                            <span className="participant-conflicts">
                              ⚠️ {p.conflicts} conflicts
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {selectedDrift.recommendations &&
                selectedDrift.recommendations.length > 0 && (
                  <div className="detail-section">
                    <h4>Recommendations</h4>
                    <ul className="recommendations-list">
                      {selectedDrift.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {selectedDrift.resolved && (
                <div className="detail-section resolved-info">
                  <h4>Resolution</h4>
                  <div className="resolution-details">
                    <p>
                      <strong>Resolved at:</strong>{' '}
                      {new Date(selectedDrift.resolvedAt).toLocaleString()}
                    </p>
                    <p>
                      <strong>Resolution:</strong>{' '}
                      {selectedDrift.resolution || 'Rescheduled'}
                    </p>
                    {selectedDrift.newSchedule && (
                      <p>
                        <strong>New Schedule:</strong>{' '}
                        {new Date(
                          selectedDrift.newSchedule.startDate
                        ).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                {!selectedDrift.resolved && !selectedDrift.ignored && (
                  <>
                    <button
                      type="button"
                      className="action-button primary"
                      onClick={() =>
                        handleReschedule(
                          selectedDrift.id,
                          selectedDrift.suggestedSchedule
                        )
                      }
                    >
                      Apply Suggested Schedule
                    </button>
                    <button
                      type="button"
                      className="action-button secondary"
                      onClick={() => handleIgnoreDrift(selectedDrift.id)}
                    >
                      Ignore Drift
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="action-button close"
                  onClick={() => setSelectedDrift(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .recurring-meeting-drift-detection {
          background: #fff;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-top: 20px;
        }

        .drift-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #f0f0f0;
          flex-wrap: wrap;
          gap: 12px;
        }

        .drift-header h3 {
          margin: 0;
          color: #333;
        }

        .drift-controls {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .mode-selector {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #fff;
          font-size: 13px;
        }

        .history-toggle,
        .refresh-button {
          padding: 6px 16px;
          background: #f0f0f0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s;
        }

        .history-toggle:hover,
        .refresh-button:hover {
          background: #e0e0e0;
        }

        .current-drift-container {
          margin-bottom: 16px;
        }

        .current-drift-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .current-drift-header h4 {
          margin: 0;
          color: #333;
        }

        .drift-status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .status-text {
          font-weight: 500;
          color: #333;
        }

        .drift-amount-badge {
          padding: 2px 10px;
          background: #f0f0f0;
          border-radius: 12px;
          font-size: 12px;
          color: #666;
        }

        .drift-entry {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .drift-entry:hover {
          transform: translateX(4px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .drift-entry.current {
          border-color: #4fc3f7;
          background: #f0f8ff;
        }

        .drift-entry.resolved {
          opacity: 0.7;
          background: #f0f8f0;
        }

        .drift-entry.ignored {
          opacity: 0.5;
          background: #f5f5f5;
        }

        .drift-entry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .drift-entry-icons {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .severity-icon {
          font-size: 20px;
        }

        .current-badge {
          padding: 2px 10px;
          background: #4fc3f7;
          color: #fff;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
        }

        .drift-entry-meta {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .severity-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          color: #fff;
          font-weight: 500;
        }

        .drift-amount {
          font-weight: 500;
          color: #333;
          font-size: 13px;
        }

        .drift-percentage {
          font-size: 13px;
          color: #888;
        }

        .badge {
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .badge.resolved {
          background: #c8e6c9;
          color: #2e7d32;
        }

        .badge.ignored {
          background: #e0e0e0;
          color: #666;
        }

        .badge.alert {
          background: #ffcdd2;
          color: #c62828;
          animation: pulse-badge 1s infinite;
        }

        @keyframes pulse-badge {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        .badge.monitoring {
          background: #e3f2fd;
          color: #1565c0;
        }

        .drift-entry-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .schedule-compare {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .schedule-item {
          display: flex;
          gap: 4px;
          font-size: 13px;
        }

        .schedule-label {
          color: #888;
        }

        .schedule-time {
          font-weight: 500;
          color: #333;
        }

        .drift-arrow {
          color: #4fc3f7;
          font-size: 16px;
        }

        .affected-count {
          font-size: 13px;
          color: #888;
        }

        .drift-entry-footer {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #999;
          padding-top: 8px;
          border-top: 1px solid #e0e0e0;
        }

        .resolution-info {
          color: #4caf50;
        }

        .ignored-info {
          color: #999;
        }

        .drift-alert {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px;
          background: #fff3e0;
          border-radius: 8px;
          border: 1px solid #ffe0b2;
          margin-top: 12px;
        }

        .alert-icon {
          font-size: 24px;
        }

        .alert-message {
          flex: 1;
        }

        .alert-message strong {
          display: block;
          color: #e65100;
        }

        .alert-message p {
          margin: 4px 0;
          color: #666;
        }

        .recommendations-list {
          list-style: none;
          padding: 0;
          margin: 8px 0 0;
        }

        .recommendations-list li {
          padding: 4px 8px;
          background: #fff;
          border-radius: 4px;
          margin-bottom: 4px;
          font-size: 13px;
          color: #333;
        }

        .alert-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .drift-history-container {
          margin-top: 16px;
          border-top: 1px solid #f0f0f0;
          padding-top: 16px;
        }

        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .history-header h4 {
          margin: 0;
          color: #333;
        }

        .history-stats {
          display: flex;
          gap: 16px;
          font-size: 13px;
          color: #888;
        }

        .history-timeline {
          max-height: 500px;
          overflow-y: auto;
        }

        .history-item-wrapper {
          display: flex;
          gap: 16px;
          margin-bottom: 8px;
        }

        .history-timeline-marker {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 16px;
        }

        .marker-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 6px;
        }

        .marker-line {
          flex: 1;
          width: 2px;
          min-height: 20px;
        }

        .marker-line.resolved {
          background: #4caf50;
        }

        .marker-line.ignored {
          background: #999;
        }

        .history-item-content {
          flex: 1;
        }

        .drift-details-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
        }

        .modal-content {
          position: relative;
          background: #fff;
          border-radius: 8px;
          max-width: 700px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          z-index: 1;
          padding: 24px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #f0f0f0;
        }

        .modal-header h3 {
          margin: 0;
          color: #333;
        }

        .close-modal {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #888;
          padding: 0 4px;
        }

        .close-modal:hover {
          color: #333;
        }

        .modal-body {
          max-height: 60vh;
          overflow-y: auto;
        }

        .detail-section {
          margin-bottom: 20px;
        }

        .detail-section h4 {
          margin: 0 0 12px;
          color: #333;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .summary-label {
          font-size: 11px;
          color: #888;
        }

        .summary-value {
          font-weight: 500;
          color: #333;
        }

        .schedule-comparison {
          display: flex;
          gap: 16px;
          align-items: stretch;
        }

        .schedule-box {
          flex: 1;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .schedule-box h5 {
          margin: 0 0 8px;
          color: #333;
        }

        .schedule-box p {
          margin: 4px 0;
          font-size: 13px;
          color: #666;
        }

        .schedule-box.original {
          border-left: 3px solid #4fc3f7;
        }

        .schedule-box.current {
          border-left: 3px solid #ffb74d;
        }

        .schedule-arrow {
          display: flex;
          align-items: center;
          font-size: 24px;
          color: #ddd;
        }

        .participants-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 8px;
        }

        .participant-card {
          display: flex;
          flex-direction: column;
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .participant-name {
          font-weight: 500;
          color: #333;
        }

        .participant-email {
          font-size: 12px;
          color: #888;
        }

        .participant-conflicts {
          font-size: 12px;
          color: #e57373;
          margin-top: 4px;
        }

        .resolved-info {
          background: #f0f8f0;
          padding: 12px;
          border-radius: 4px;
        }

        .resolution-details p {
          margin: 4px 0;
          font-size: 14px;
          color: #333;
        }

        .modal-actions {
          display: flex;
          gap: 8px;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #e0e0e0;
          flex-wrap: wrap;
        }

        .action-button {
          padding: 8px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: opacity 0.2s;
