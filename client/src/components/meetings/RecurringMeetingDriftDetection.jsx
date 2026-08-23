// src/components/meeting/RecurringMeetingDriftDetection.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

const RecurringMeetingDriftDetection = ({
  meetingId,
  recurrencePattern,
  participants = [],
  onDriftDetected,
  onScheduleUpdate,
}) => {
  const [driftData, setDriftData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDrift, setSelectedDrift] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [analysisMode, setAnalysisMode] = useState('auto');

  useEffect(() => {
    const analyzeDrift = async () => {
      if (!meetingId || !recurrencePattern) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/meetings/${meetingId}/drift-analysis`, {
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
        setDriftData(data);

        if (onDriftDetected) {
          onDriftDetected(data);
        }

        if (data.driftDetected && data.driftSeverity === 'high') {
          setSelectedDrift(data);
        }
      } catch (err) {
        setError(err.message);
        console.error('Drift analysis error:', err);
      } finally {
        setLoading(false);
      }
    };

    analyzeDrift();
  }, [meetingId, recurrencePattern, participants, analysisMode, onDriftDetected]);

  const driftMetrics = useMemo(() => {
    if (!driftData) return null;

    const {
      originalSchedule,
      currentSchedule,
      driftAmount,
      driftPercentage,
      affectedParticipants,
      driftSeverity,
    } = driftData;

    return {
      original: originalSchedule,
      current: currentSchedule,
      amount: driftAmount,
      percentage: driftPercentage,
      affected: affectedParticipants,
      severity: driftSeverity,
    };
  }, [driftData]);

  const calculateNextOccurrences = useCallback((pattern, count = 5) => {
    const occurrences = [];
    const startDate = new Date(pattern.startDate);

    for (let i = 0; i < count; i++) {
      const nextDate = new Date(startDate);
      switch (pattern.frequency) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + i * pattern.interval);
          break;
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + i * 7 * pattern.interval);
          break;
        case 'biweekly':
          nextDate.setDate(nextDate.getDate() + i * 14 * pattern.interval);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + i * pattern.interval);
          break;
        default:
          break;
      }
      occurrences.push(nextDate);
    }
    return occurrences;
  }, []);

  const handleReschedule = useCallback(
    async (newSchedule) => {
      try {
        const response = await fetch(`/api/meetings/${meetingId}/reschedule`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...newSchedule,
            participants: participants.map((p) => p.email),
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to reschedule meeting');
        }

        const updatedMeeting = await response.json();

        if (onScheduleUpdate) {
          onScheduleUpdate(updatedMeeting);
        }

        setSelectedDrift(null);
        setShowDetails(false);

        return updatedMeeting;
      } catch (err) {
        setError(err.message);
        console.error('Reschedule error:', err);
        throw err;
      }
    },
    [meetingId, participants, onScheduleUpdate]
  );

  const getSeverityColor = (severity) => {
    const colors = {
      low: '#81c784',
      medium: '#ffb74d',
      high: '#e57373',
      critical: '#d32f2f',
    };
    return colors[severity] || colors.low;
  };

  const getSeverityLabel = (severity) => {
    const labels = {
      low: 'Low Drift - Minor Adjustments',
      medium: 'Medium Drift - Significant Changes',
      high: 'High Drift - Major Conflicts',
      critical: 'Critical - Needs Immediate Action',
    };
    return labels[severity] || labels.low;
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

  if (!driftData) {
    return (
      <div className="drift-detection-empty">
        <div className="empty-icon">📊</div>
        <h3>No drift data available</h3>
        <p>Start your recurring meeting to begin tracking patterns.</p>
      </div>
    );
  }

  const { severity, driftAmount, driftPercentage, originalSchedule, currentSchedule } = driftData;

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
            <option value="participant">Participant-based</option>
          </select>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="details-toggle"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>

      <div className="drift-summary">
        <div
          className="drift-status"
          style={{
            borderLeftColor: getSeverityColor(severity),
          }}
        >
          <div className="status-indicator">
            <div
              className="status-dot"
              style={{ backgroundColor: getSeverityColor(severity) }}
            />
            <span className="status-label">{getSeverityLabel(severity)}</span>
          </div>
          <div className="drift-metrics">
            <div className="metric">
              <span className="metric-label">Drift Amount</span>
              <span className="metric-value">{driftAmount} minutes</span>
            </div>
            <div className="metric">
              <span className="metric-label">Drift Percentage</span>
              <span className="metric-value">{driftPercentage}%</span>
            </div>
          </div>
        </div>

        {severity === 'high' || severity === 'critical' ? (
          <div className="drift-alert">
            <div className="alert-icon">🚨</div>
            <div className="alert-message">
              <strong>Significant drift detected!</strong>
              <p>
                The recurring meeting has drifted from its original schedule.
                Consider rescheduling to maintain consistency.
              </p>
            </div>
            <button
              type="button"
              className="reschedule-button"
              onClick={() => setSelectedDrift(driftData)}
            >
              Reschedule Now
            </button>
          </div>
        ) : null}
      </div>

      {showDetails && (
        <div className="drift-details">
          <div className="schedule-comparison">
            <div className="original-schedule">
              <h4>Original Schedule</h4>
              <div className="schedule-info">
                <p>Start: {new Date(originalSchedule.startDate).toLocaleString()}</p>
                <p>Duration: {originalSchedule.duration} minutes</p>
                <p>Frequency: {originalSchedule.frequency}</p>
                <p>Interval: Every {originalSchedule.interval} {originalSchedule.frequency}</p>
              </div>
              <div className="occurrence-preview">
                <h5>Upcoming Occurrences</h5>
                {calculateNextOccurrences(originalSchedule, 3).map((date, idx) => (
                  <div key={idx} className="occurrence">
                    {date.toLocaleString()}
                  </div>
                ))}
              </div>
            </div>

            <div className="drift-arrow">⟶</div>

            <div className="current-schedule">
              <h4>Current Schedule</h4>
              <div className="schedule-info">
                <p>Start: {new Date(currentSchedule.startDate).toLocaleString()}</p>
                <p>Duration: {currentSchedule.duration} minutes</p>
                <p>Frequency: {currentSchedule.frequency}</p>
                <p>Interval: Every {currentSchedule.interval} {currentSchedule.frequency}</p>
              </div>
              <div className="occurrence-preview">
                <h5>Upcoming Occurrences</h5>
                {calculateNextOccurrences(currentSchedule, 3).map((date, idx) => (
                  <div key={idx} className="occurrence">
                    {date.toLocaleString()}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="affected-participants">
            <h4>Affected Participants</h4>
            <div className="participant-list">
              {driftData.affectedParticipants.map((participant, idx) => (
                <div key={idx} className="participant-item">
                  <span className="participant-name">{participant.name}</span>
                  <span className="participant-status">
                    {participant.conflicts > 0 ? `⚠️ ${participant.conflicts} conflicts` : '✅ Available'}
                  </span>
                  <span className="participant-timezone">
                    {participant.timezone}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="drift-recommendations">
            <h4>Recommendations</h4>
            <ul>
              {driftData.recommendations.map((rec, idx) => (
                <li key={idx} className="recommendation-item">
                  <span className="recommendation-icon">{rec.icon || '💡'}</span>
                  <span className="recommendation-text">{rec.message}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="drift-actions">
            <button
              type="button"
              className="action-button update"
              onClick={() => handleReschedule(driftData.suggestedSchedule)}
            >
              Apply Suggested Schedule
            </button>
            <button
              type="button"
              className="action-button ignore"
              onClick={() => setSelectedDrift(null)}
            >
              Ignore Drift
            </button>
            <button
              type="button"
              className="action-button analyze"
              onClick={() => {
                setAnalysisMode('manual');
                const newMode = analysisMode === 'manual' ? 'auto' : 'manual';
                setAnalysisMode(newMode);
              }}
            >
              Re-analyze
            </button>
          </div>
        </div>
      )}

      {selectedDrift && (
        <div className="drift-reschedule-modal">
          <div className="modal-overlay" onClick={() => setSelectedDrift(null)} />
          <div className="modal-content">
            <h3>Reschedule Recurring Meeting</h3>
            <p>
              The meeting has drifted by {selectedDrift.driftAmount} minutes from
              its original schedule. Apply the suggested changes?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-button confirm"
                onClick={() => handleReschedule(selectedDrift.suggestedSchedule)}
              >
                Yes, Reschedule
              </button>
              <button
                type="button"
                className="modal-button cancel"
                onClick={() => setSelectedDrift(null)}
              >
                No, Keep Current
              </button>
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
        }

        .drift-header h3 {
          margin: 0;
          color: #333;
        }

        .drift-controls {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .mode-selector {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #fff;
          font-size: 13px;
        }

        .details-toggle {
          padding: 6px 16px;
          background: #f0f0f0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s;
        }

        .details-toggle:hover {
          background: #e0e0e0;
        }

        .drift-summary {
          margin-bottom: 16px;
        }

        .drift-status {
          padding: 16px;
          border-left: 4px solid;
          background: #f8f9fa;
          border-radius: 4px;
          margin-bottom: 12px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }

        .status-label {
          font-weight: 500;
          color: #333;
        }

        .drift-metrics {
          display: flex;
          gap: 24px;
        }

        .metric {
          display: flex;
          flex-direction: column;
        }

        .metric-label {
          font-size: 12px;
          color: #888;
        }

        .metric-value {
          font-weight: 600;
          color: #333;
        }

        .drift-alert {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #fff3e0;
          border-radius: 4px;
          border: 1px solid #ffe0b2;
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
          margin: 4px 0 0;
          color: #666;
        }

        .reschedule-button {
          padding: 8px 20px;
          background: #ff9800;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s;
        }

        .reschedule-button:hover {
          background: #f57c00;
        }

        .drift-details {
          margin-top: 16px;
          border-top: 1px solid #f0f0f0;
          padding-top: 16px;
        }

        .schedule-comparison {
          display: flex;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .original-schedule,
        .current-schedule {
          flex: 1;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .original-schedule h4,
        .current-schedule h4 {
          margin: 0 0 12px;
          color: #333;
        }

        .schedule-info p {
          margin: 4px 0;
          font-size: 14px;
          color: #666;
        }

        .occurrence-preview {
          margin-top: 12px;
        }

        .occurrence-preview h5 {
          margin: 0 0 8px;
          font-size: 13px;
          color: #888;
        }

        .occurrence {
          padding: 4px 8px;
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          margin-bottom: 4px;
          font-size: 13px;
          color: #333;
        }

        .drift-arrow {
          font-size: 24px;
          color: #4fc3f7;
          padding-top: 40px;
        }

        .affected-participants {
          margin-bottom: 20px;
        }

        .affected-participants h4 {
          margin: 0 0 12px;
          color: #333;
        }

        .participant-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 8px;
        }

        .participant-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 4px;
          font-size: 13px;
        }

        .participant-name {
          font-weight: 500;
          color: #333;
        }

        .participant-status {
          color: #666;
        }

        .participant-timezone {
          color: #999;
          font-size: 11px;
        }

        .drift-recommendations {
          margin-bottom: 20px;
        }

        .drift-recommendations h4 {
          margin: 0 0 12px;
          color: #333;
        }

        .drift-recommendations ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .recommendation-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 4px;
          margin-bottom: 4px;
        }

        .recommendation-icon {
          font-size: 18px;
        }

        .recommendation-text {
          color: #333;
          font-size: 14px;
        }

        .drift-actions {
          display: flex;
          gap: 8px;
        }

        .action-button {
          padding: 8px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: opacity 0.2s;
        }

        .action-button:hover {
          opacity: 0.8;
        }

        .action-button.update {
          background: #4fc3f7;
          color: #fff;
        }

        .action-button.ignore {
          background: #f0f0f0;
          color: #666;
        }

        .action-button.analyze {
          background: #81c784;
          color: #fff;
        }

        .drift-reschedule-modal {
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
          padding: 32px;
          border-radius: 8px;
          max-width: 500px;
          width: 90%;
          z-index: 1;
        }

        .modal-content h3 {
          margin: 0 0 12px;
          color: #333;
        }

        .modal-content p {
          color: #666;
          margin-bottom: 20px;
        }

        .modal-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .modal-button {
          padding: 8px 24px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: opacity 0.2s;
        }

        .modal-button:hover {
          opacity: 0.8;
        }

        .modal-button.confirm {
          background: #4fc3f7;
          color: #fff;
        }

        .modal-button.cancel {
          background: #f0f0f0;
          color: #666;
        }

        .drift-detection-loading,
        .drift-detection-error,
        .drift-detection-empty {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #4fc3f7;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .error-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .retry-button {
          padding: 8px 24px;
          background: #4fc3f7;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          margin-top: 12px;
        }

        .retry-button:hover {
          background: #39b3e6;
        }
      `}</style>
    </div>
  );
};

RecurringMeetingDriftDetection.propTypes = {
  meetingId: PropTypes.string.isRequired,
  recurrencePattern: PropTypes.shape({
    frequency: PropTypes.oneOf(['daily', 'weekly', 'biweekly', 'monthly']).isRequired,
    interval: PropTypes.number.isRequired,
    startDate: PropTypes.string.isRequired,
    duration: PropTypes.number.isRequired,
    endDate: PropTypes.string,
  }).isRequired,
  participants: PropTypes.arrayOf(
    PropTypes.shape({
      email: PropTypes.string.isRequired,
      name: PropTypes.string,
      timezone: PropTypes.string,
    })
  ),
  onDriftDetected: PropTypes.func,
  onScheduleUpdate: PropTypes.func,
};

RecurringMeetingDriftDetection.defaultProps = {
  participants: [],
  onDriftDetected: null,
  onScheduleUpdate: null,
};

export default RecurringMeetingDriftDetection;
