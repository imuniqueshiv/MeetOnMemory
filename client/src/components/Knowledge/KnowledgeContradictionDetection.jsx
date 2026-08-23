// src/components/knowledge/KnowledgeContradictionDetection.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

const KnowledgeContradictionDetection = ({
  projectId,
  knowledgeBase = [],
  onContradictionResolved,
  onInsightGenerated,
}) => {
  const [contradictions, setContradictions] = useState([]);
  const [selectedContradiction, setSelectedContradiction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [resolutionMode, setResolutionMode] = useState('auto');

  useEffect(() => {
    const detectContradictions = async () => {
      if (!projectId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/projects/${projectId}/contradictions/detect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            knowledgeBase,
            resolutionMode,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to detect knowledge contradictions');
        }

        const data = await response.json();
        setContradictions(data.contradictions || []);
      } catch (err) {
        setError(err.message);
        console.error('Contradiction detection error:', err);
      } finally {
        setLoading(false);
      }
    };

    detectContradictions();
  }, [projectId, knowledgeBase, resolutionMode]);

  const contradictionStats = useMemo(() => {
    const stats = {
      total: contradictions.length,
      critical: 0,
      moderate: 0,
      minor: 0,
      resolved: 0,
      unresolved: 0,
    };

    contradictions.forEach((c) => {
      if (c.severity === 'critical') stats.critical += 1;
      else if (c.severity === 'moderate') stats.moderate += 1;
      else if (c.severity === 'minor') stats.minor += 1;

      if (c.resolved) stats.resolved += 1;
      else stats.unresolved += 1;
    });

    return stats;
  }, [contradictions]);

  const filteredContradictions = useMemo(() => {
    let filtered = contradictions;

    if (filter !== 'all') {
      filtered = filtered.filter((c) => {
        if (filter === 'resolved') return c.resolved;
        if (filter === 'unresolved') return !c.resolved;
        return c.severity === filter;
      });
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.statement1?.toLowerCase().includes(term) ||
          c.statement2?.toLowerCase().includes(term) ||
          c.topic?.toLowerCase().includes(term) ||
          c.explanation?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [contradictions, filter, searchTerm]);

  const getSeverityColor = (severity) => {
    const colors = {
      critical: '#e57373',
      moderate: '#ffb74d',
      minor: '#ffd54f',
    };
    return colors[severity] || colors.minor;
  };

  const getSeverityLabel = (severity) => {
    const labels = {
      critical: 'Critical',
      moderate: 'Moderate',
      minor: 'Minor',
    };
    return labels[severity] || severity;
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      critical: '🚨',
      moderate: '⚠️',
      minor: '🔍',
    };
    return icons[severity] || '📌';
  };

  const handleResolveContradiction = useCallback(
    async (contradictionId, resolution) => {
      try {
        const response = await fetch(`/api/contradictions/${contradictionId}/resolve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resolution,
            resolvedBy: 'Current User',
            resolvedAt: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to resolve contradiction');
        }

        const resolvedContradiction = await response.json();
        setContradictions((prev) =>
          prev.map((c) =>
            c.id === contradictionId ? resolvedContradiction : c
          )
        );

        if (onContradictionResolved) {
          onContradictionResolved(resolvedContradiction);
        }

        return resolvedContradiction;
      } catch (err) {
        setError(err.message);
        console.error('Resolution error:', err);
        throw err;
      }
    },
    [onContradictionResolved]
  );

  const generateInsights = useCallback(
    async (contradictionId) => {
      try {
        const response = await fetch(
          `/api/contradictions/${contradictionId}/insights`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to generate insights');
        }

        const insights = await response.json();
        if (onInsightGenerated) {
          onInsightGenerated(insights);
        }
        return insights;
      } catch (err) {
        setError(err.message);
        console.error('Insight generation error:', err);
        throw err;
      }
    },
    [onInsightGenerated]
  );

  const getResolutionOptions = (contradiction) => {
    const options = [
      {
        id: 'keep_first',
        label: 'Keep First Statement',
        description: 'Accept the first statement as correct',
      },
      {
        id: 'keep_second',
        label: 'Keep Second Statement',
        description: 'Accept the second statement as correct',
      },
      {
        id: 'merge',
        label: 'Merge Both',
        description: 'Create a synthesized version that resolves the conflict',
      },
      {
        id: 'reject_both',
        label: 'Reject Both',
        description: 'Both statements are incorrect and should be rejected',
      },
      {
        id: 'contextual',
        label: 'Contextual Resolution',
        description: 'Resolve based on context and evidence',
      },
    ];
    return options;
  };

  if (loading) {
    return (
      <div className="contradiction-detection-loading">
        <div className="spinner" />
        <p>Scanning knowledge base for contradictions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="contradiction-detection-error">
        <div className="error-icon">🔍</div>
        <h3>Unable to detect contradictions</h3>
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

  if (contradictions.length === 0) {
    return (
      <div className="contradiction-detection-empty">
        <div className="empty-icon">✅</div>
        <h3>No Contradictions Detected</h3>
        <p>
          Your knowledge base appears consistent. No contradictions were found
          across {knowledgeBase.length} knowledge entries.
        </p>
        <button
          type="button"
          className="rescan-button"
          onClick={() => {
            setResolutionMode('deep');
            const event = new Event('change');
            document.dispatchEvent(event);
          }}
        >
          Deep Scan
        </button>
      </div>
    );
  }

  return (
    <div className="knowledge-contradiction-detection">
      <div className="detection-header">
        <h3>Knowledge Contradiction Detection</h3>
        <div className="detection-controls">
          <input
            type="text"
            placeholder="Search contradictions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Contradictions</option>
            <option value="critical">Critical</option>
            <option value="moderate">Moderate</option>
            <option value="minor">Minor</option>
            <option value="unresolved">Unresolved</option>
            <option value="resolved">Resolved</option>
          </select>
          <button
            type="button"
            className="rescan-button"
            onClick={() => {
              setResolutionMode(resolutionMode === 'auto' ? 'deep' : 'auto');
              const event = new Event('change');
              document.dispatchEvent(event);
            }}
          >
            {resolutionMode === 'auto' ? 'Deep Scan' : 'Quick Scan'}
          </button>
        </div>
      </div>

      <div className="contradiction-stats">
        <div className="stat-item">
          <span className="stat-value">{contradictionStats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item critical">
          <span className="stat-value">{contradictionStats.critical}</span>
          <span className="stat-label">Critical</span>
        </div>
        <div className="stat-item moderate">
          <span className="stat-value">{contradictionStats.moderate}</span>
          <span className="stat-label">Moderate</span>
        </div>
        <div className="stat-item minor">
          <span className="stat-value">{contradictionStats.minor}</span>
          <span className="stat-label">Minor</span>
        </div>
        <div className="stat-item resolved">
          <span className="stat-value">{contradictionStats.resolved}</span>
          <span className="stat-label">Resolved</span>
        </div>
        <div className="stat-item unresolved">
          <span className="stat-value">{contradictionStats.unresolved}</span>
          <span className="stat-label">Unresolved</span>
        </div>
      </div>

      <div className="contradictions-list">
        {filteredContradictions.map((contradiction) => (
          <div
            key={contradiction.id}
            className={`contradiction-item ${
              contradiction.resolved ? 'resolved' : ''
            } ${contradiction.severity}`}
            onClick={() => setSelectedContradiction(contradiction)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSelectedContradiction(contradiction);
              }
            }}
          >
            <div className="contradiction-header">
              <div className="contradiction-icons">
                <span className="severity-icon">
                  {getSeverityIcon(contradiction.severity)}
                </span>
                {contradiction.resolved && <span className="resolved-badge">✅</span>}
              </div>
              <div className="contradiction-topic">
                <span className="topic-label">Topic:</span>
                <span className="topic-value">{contradiction.topic}</span>
              </div>
              <div
                className="severity-badge"
                style={{
                  backgroundColor: getSeverityColor(contradiction.severity),
                }}
              >
                {getSeverityLabel(contradiction.severity)}
              </div>
            </div>

            <div className="contradiction-statements">
              <div className="statement statement-1">
                <span className="statement-label">Statement 1:</span>
                <span className="statement-text">{contradiction.statement1}</span>
                <span className="statement-source">
                  Source: {contradiction.source1}
                </span>
              </div>
              <div className="statement-divider">⟷</div>
              <div className="statement statement-2">
                <span className="statement-label">Statement 2:</span>
                <span className="statement-text">{contradiction.statement2}</span>
                <span className="statement-source">
                  Source: {contradiction.source2}
                </span>
              </div>
            </div>

            <div className="contradiction-meta">
              <span className="confidence">
                Confidence: {(contradiction.confidence * 100).toFixed(0)}%
              </span>
              <span className="detected-date">
                Detected: {new Date(contradiction.detectedAt).toLocaleDateString()}
              </span>
              {contradiction.resolved && (
                <span className="resolved-date">
                  Resolved: {new Date(contradiction.resolvedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedContradiction && (
        <div className="contradiction-details-modal">
          <div
            className="modal-overlay"
            onClick={() => setSelectedContradiction(null)}
          />
          <div className="modal-content">
            <div className="modal-header">
              <h3>Contradiction Details</h3>
              <button
                type="button"
                className="close-modal"
                onClick={() => setSelectedContradiction(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h4>Topic</h4>
                <p>{selectedContradiction.topic}</p>
              </div>

              <div className="detail-section">
                <h4>Statements</h4>
                <div className="detail-statements">
                  <div className="detail-statement">
                    <span className="detail-label">Statement 1:</span>
                    <p>{selectedContradiction.statement1}</p>
                    <small>Source: {selectedContradiction.source1}</small>
                  </div>
                  <div className="detail-statement">
                    <span className="detail-label">Statement 2:</span>
                    <p>{selectedContradiction.statement2}</p>
                    <small>Source: {selectedContradiction.source2}</small>
                  </div>
                </div>
              </div>

              {selectedContradiction.explanation && (
                <div className="detail-section">
                  <h4>Explanation</h4>
                  <p>{selectedContradiction.explanation}</p>
                </div>
              )}

              {selectedContradiction.evidence && (
                <div className="detail-section">
                  <h4>Supporting Evidence</h4>
                  <ul className="evidence-list">
                    {selectedContradiction.evidence.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!selectedContradiction.resolved && (
                <div className="detail-section">
                  <h4>Resolution Options</h4>
                  <div className="resolution-options">
                    {getResolutionOptions(selectedContradiction).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className="resolution-option"
                        onClick={() =>
                          handleResolveContradiction(
                            selectedContradiction.id,
                            option.id
                          )
                        }
                      >
                        <span className="option-label">{option.label}</span>
                        <span className="option-description">
                          {option.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedContradiction.resolved && (
                <div className="detail-section resolved-info">
                  <h4>Resolution</h4>
                  <div className="resolution-details">
                    <p>
                      <strong>Resolved by:</strong> {selectedContradiction.resolvedBy}
                    </p>
                    <p>
                      <strong>Resolution:</strong> {selectedContradiction.resolution}
                    </p>
                    <p>
                      <strong>Resolved at:</strong>{' '}
                      {new Date(selectedContradiction.resolvedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              <div className="modal-actions">
                {!selectedContradiction.resolved && (
                  <>
                    <button
                      type="button"
                      className="action-button insights"
                      onClick={() => generateInsights(selectedContradiction.id)}
                    >
                      Generate Insights
                    </button>
                    <button
                      type="button"
                      className="action-button resolve"
                      onClick={() =>
                        handleResolveContradiction(
                          selectedContradiction.id,
                          'auto'
                        )
                      }
                    >
                      Auto-Resolve
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="action-button close"
                  onClick={() => setSelectedContradiction(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .knowledge-contradiction-detection {
          background: #fff;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-top: 20px;
        }

        .detection-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #f0f0f0;
          flex-wrap: wrap;
          gap: 12px;
        }

        .detection-header h3 {
          margin: 0;
          color: #333;
        }

        .detection-controls {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .search-input {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          min-width: 200px;
        }

        .search-input:focus {
          outline: none;
          border-color: #4fc3f7;
        }

        .filter-select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #fff;
          font-size: 14px;
        }

        .rescan-button {
          padding: 8px 16px;
          background: #4fc3f7;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s;
        }

        .rescan-button:hover {
          background: #39b3e6;
        }

        .contradiction-stats {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 4px;
          flex-wrap: wrap;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 12px;
          border-right: 1px solid #e0e0e0;
        }

        .stat-item:last-child {
          border-right: none;
        }

        .stat-item.critical .stat-value {
          color: #e57373;
        }

        .stat-item.moderate .stat-value {
          color: #ffb74d;
        }

        .stat-item.minor .stat-value {
          color: #ffd54f;
        }

        .stat-item.resolved .stat-value {
          color: #81c784;
        }

        .stat-item.unresolved .stat-value {
          color: #4fc3f7;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 600;
          color: #333;
        }

        .stat-label {
          font-size: 11px;
          color: #888;
        }

        .contradictions-list {
          max-height: 500px;
          overflow-y: auto;
        }

        .contradiction-item {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .contradiction-item:hover {
          transform: translateX(4px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .contradiction-item.resolved {
          opacity: 0.7;
          background: #f0f8f0;
        }

        .contradiction-item.critical {
          border-left: 4px solid #e57373;
        }

        .contradiction-item.moderate {
          border-left: 4px solid #ffb74d;
        }

        .contradiction-item.minor {
          border-left: 4px solid #ffd54f;
        }

        .contradiction-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .contradiction-icons {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .severity-icon {
          font-size: 20px;
        }

        .resolved-badge {
          font-size: 16px;
        }

        .contradiction-topic {
          flex: 1;
        }

        .topic-label {
          font-size: 12px;
          color: #888;
          margin-right: 4px;
        }

        .topic-value {
          font-weight: 500;
          color: #333;
        }

        .severity-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          color: #fff;
          font-weight: 500;
        }

        .contradiction-statements {
          display: flex;
          align-items: stretch;
          gap: 12px;
          margin-bottom: 12px;
        }

        .statement {
          flex: 1;
          padding: 8px 12px;
          background: #fff;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
        }

        .statement-1 {
          border-left: 3px solid #4fc3f7;
        }

        .statement-2 {
          border-left: 3px solid #ffb74d;
        }

        .statement-label {
          font-size: 11px;
          font-weight: 600;
          color: #888;
          display: block;
          margin-bottom: 4px;
        }

        .statement-text {
          font-size: 14px;
          color: #333;
          display: block;
          margin-bottom: 4px;
        }

        .statement-source {
          font-size: 11px;
          color: #999;
        }

        .statement-divider {
          display: flex;
          align-items: center;
          color: #ddd;
          font-size: 20px;
          padding: 0 4px;
        }

        .contradiction-meta {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #888;
          padding-top: 8px;
          border-top: 1px solid #e0e0e0;
        }

        .contradiction-details-modal {
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

        .detail-section {
          margin-bottom: 20px;
        }

        .detail-section h4 {
          margin: 0 0 8px;
          color: #333;
        }

        .detail-statements {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .detail-statement {
          padding: 12px;
          background: #f8f9fa;
          border-radius: 4px;
          border-left: 3px solid #4fc3f7;
        }

        .detail-statement:last-child {
          border-left-color: #ffb74d;
        }

        .detail-label {
          font-weight: 600;
          color: #888;
          font-size: 12px;
          display: block;
          margin-bottom: 4px;
        }

        .detail-statement p {
          margin: 0 0 4px;
          color: #333;
        }

        .detail-statement small {
          color: #999;
          font-size: 12px;
        }

        .evidence-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .evidence-list li {
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 4px;
          margin-bottom: 4px;
          font-size: 14px;
          color: #333;
        }

        .resolution-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .resolution-option {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 12px;
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          text-align: left;
        }

        .resolution-option:hover {
          background: #e3f2fd;
          border-color: #4fc3f7;
        }

        .option-label {
          font-weight: 500;
          color: #333;
          margin-bottom: 4px;
        }

        .option-description {
          font-size: 13px;
          color: #888;
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

        .action-button.insights {
          background: #4fc3f7;
          color: #fff;
        }

        .action-button.resolve {
          background: #81c784;
          color: #fff;
        }

        .action-button.close {
          background: #f0f0f0;
          color: #666;
        }

        .contradiction-detection-loading,
        .contradiction-detection-error,
        .contradiction-detection-empty {
          text-align: center;
          padding: 60px 20px;
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

        .empty-icon,
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

KnowledgeContradictionDetection.propTypes = {
  projectId: PropTypes.string.isRequired,
  knowledgeBase: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      content: PropTypes.string,
      source: PropTypes.string,
      topic: PropTypes.string,
      timestamp: PropTypes.string,
    })
  ),
  onContradictionResolved: PropTypes.func,
  onInsightGenerated: PropTypes.func,
};

KnowledgeContradictionDetection.defaultProps = {
  knowledgeBase: [],
  onContradictionResolved: null,
  onInsightGenerated: null,
};

export default KnowledgeContradictionDetection;
