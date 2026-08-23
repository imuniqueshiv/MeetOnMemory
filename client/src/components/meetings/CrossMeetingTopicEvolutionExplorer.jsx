// src/components/meeting/CrossMeetingTopicEvolutionExplorer.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

const CrossMeetingTopicEvolutionExplorer = ({
  projectId,
  meetings = [],
  onTopicSelect,
  onInsightGenerate,
}) => {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topicHistory, setTopicHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('timeline');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchTopics = async () => {
      if (!projectId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/projects/${projectId}/topics/evolution`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch topic evolution data');
        }

        const data = await response.json();
        setTopics(data.topics || []);
        setTopicHistory(data.history || []);
      } catch (err) {
        setError(err.message);
        console.error('Topic evolution fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
  }, [projectId]);

  const topicClusters = useMemo(() => {
    const clusters = {};
    topics.forEach((topic) => {
      const clusterId = topic.clusterId || 'uncategorized';
      if (!clusters[clusterId]) {
        clusters[clusterId] = {
          name: topic.clusterName || 'Uncategorized',
          topics: [],
          count: 0,
          evolution: [],
        };
      }
      clusters[clusterId].topics.push(topic);
      clusters[clusterId].count += 1;
      if (topic.evolution) {
        clusters[clusterId].evolution.push(topic.evolution);
      }
    });
    return clusters;
  }, [topics]);

  const topicTimeline = useMemo(() => {
    const timeline = [];
    const sortedMeetings = [...meetings].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    sortedMeetings.forEach((meeting) => {
      const meetingTopics = topics.filter((t) => t.meetingId === meeting.id);
      if (meetingTopics.length > 0) {
        timeline.push({
          meeting,
          topics: meetingTopics,
          date: new Date(meeting.date),
        });
      }
    });

    return timeline;
  }, [topics, meetings]);

  const topicConnections = useMemo(() => {
    const connections = {};
    topics.forEach((topic) => {
      if (topic.relatedTopics) {
        topic.relatedTopics.forEach((related) => {
          const key = [topic.id, related.id].sort().join('-');
          if (!connections[key]) {
            connections[key] = {
              source: topic,
              target: related,
              strength: related.strength || 0.5,
              meetings: [],
            };
          }
          connections[key].meetings.push(topic.meetingId);
        });
      }
    });
    return Object.values(connections);
  }, [topics]);

  const filteredTopics = useMemo(() => {
    let filtered = topics;

    if (filter !== 'all') {
      filtered = filtered.filter((t) => t.status === filter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(term) ||
          t.description?.toLowerCase().includes(term) ||
          t.keywords?.some((k) => k.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [topics, filter, searchTerm]);

  const handleTopicClick = useCallback(
    (topic) => {
      setSelectedTopic(topic);
      if (onTopicSelect) {
        onTopicSelect(topic);
      }

      // Fetch topic details
      const fetchTopicDetails = async () => {
        try {
          const response = await fetch(`/api/topics/${topic.id}/evolution`);
          if (response.ok) {
            const details = await response.json();
            setTopicHistory(details.history || []);
          }
        } catch (err) {
          console.error('Topic details fetch error:', err);
        }
      };
      fetchTopicDetails();
    },
    [onTopicSelect]
  );

  const generateInsights = useCallback(async () => {
    if (!selectedTopic) return;

    try {
      const response = await fetch(`/api/topics/${selectedTopic.id}/insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          meetings: meetings.map((m) => m.id),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate insights');
      }

      const insights = await response.json();
      if (onInsightGenerate) {
        onInsightGenerate(insights);
      }
      return insights;
    } catch (err) {
      setError(err.message);
      console.error('Insight generation error:', err);
      throw err;
    }
  }, [selectedTopic, projectId, meetings, onInsightGenerate]);

  const getTopicStatusColor = (status) => {
    const colors = {
      new: '#4fc3f7',
      evolving: '#ffb74d',
      mature: '#81c784',
      declining: '#e57373',
      resolved: '#9575cd',
    };
    return colors[status] || colors.new;
  };

  const getTopicStatusLabel = (status) => {
    const labels = {
      new: 'New',
      evolving: 'Evolving',
      mature: 'Mature',
      declining: 'Declining',
      resolved: 'Resolved',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="topic-explorer-loading">
        <div className="spinner" />
        <p>Analyzing topic evolution across meetings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="topic-explorer-error">
        <div className="error-icon">🔍</div>
        <h3>Unable to explore topics</h3>
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

  if (topics.length === 0) {
    return (
      <div className="topic-explorer-empty">
        <div className="empty-icon">🧠</div>
        <h3>No topics discovered yet</h3>
        <p>
          Topics will appear as meetings are conducted and analyzed.
          Connect your meetings to start tracking topic evolution.
        </p>
      </div>
    );
  }

  return (
    <div className="cross-meeting-topic-explorer">
      <div className="explorer-header">
        <h3>Cross-Meeting Topic Evolution</h3>
        <div className="explorer-controls">
          <input
            type="text"
            placeholder="Search topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Topics</option>
            <option value="new">New</option>
            <option value="evolving">Evolving</option>
            <option value="mature">Mature</option>
            <option value="declining">Declining</option>
            <option value="resolved">Resolved</option>
          </select>
          <button
            type="button"
            className="view-toggle"
            onClick={() =>
              setViewMode(viewMode === 'timeline' ? 'cluster' : 'timeline')
            }
          >
            {viewMode === 'timeline' ? 'Cluster View' : 'Timeline View'}
          </button>
        </div>
      </div>

      <div className="topic-stats">
        <div className="stat-item">
          <span className="stat-value">{topics.length}</span>
          <span className="stat-label">Total Topics</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {topics.filter((t) => t.status === 'evolving').length}
          </span>
          <span className="stat-label">Evolving</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {topics.filter((t) => t.status === 'new').length}
          </span>
          <span className="stat-label">New</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {topics.filter((t) => t.status === 'resolved').length}
          </span>
          <span className="stat-label">Resolved</span>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        <div className="timeline-view">
          <div className="timeline">
            {topicTimeline.map((item, idx) => (
              <div key={idx} className="timeline-item">
                <div className="timeline-date">
                  {item.date.toLocaleDateString()}
                  <span className="timeline-time">
                    {item.date.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="timeline-content">
                  <div className="meeting-name">{item.meeting.name}</div>
                  <div className="topic-pills">
                    {item.topics.map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        className={`topic-pill ${
                          selectedTopic?.id === topic.id ? 'selected' : ''
                        }`}
                        style={{
                          borderColor: getTopicStatusColor(topic.status),
                        }}
                        onClick={() => handleTopicClick(topic)}
                      >
                        {topic.name}
                        <span
                          className="topic-status-dot"
                          style={{
                            backgroundColor: getTopicStatusColor(topic.status),
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="cluster-view">
          {Object.entries(topicClusters).map(([clusterId, cluster]) => (
            <div key={clusterId} className="cluster-container">
              <div className="cluster-header">
                <h4>{cluster.name}</h4>
                <span className="cluster-count">{cluster.count} topics</span>
              </div>
              <div className="cluster-grid">
                {cluster.topics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    className={`topic-card ${
                      selectedTopic?.id === topic.id ? 'selected' : ''
                    }`}
                    onClick={() => handleTopicClick(topic)}
                  >
                    <div className="topic-card-header">
                      <span className="topic-name">{topic.name}</span>
                      <span
                        className="topic-status"
                        style={{
                          backgroundColor: getTopicStatusColor(topic.status),
                        }}
                      >
                        {getTopicStatusLabel(topic.status)}
                      </span>
                    </div>
                    <div className="topic-card-body">
                      <p className="topic-description">{topic.description}</p>
                      {topic.keywords && topic.keywords.length > 0 && (
                        <div className="topic-keywords">
                          {topic.keywords.slice(0, 3).map((keyword, idx) => (
                            <span key={idx} className="keyword-tag">
                              #{keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="topic-card-footer">
                      <span className="topic-meetings">
                        📅 {topic.meetingCount || 0} meetings
                      </span>
                      <span className="topic-evolution">
                        {topic.evolution?.trend || 'stable'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTopic && (
        <div className="topic-details-panel">
          <div className="panel-header">
            <h4>{selectedTopic.name}</h4>
            <button
              type="button"
              className="close-panel"
              onClick={() => setSelectedTopic(null)}
            >
              ✕
            </button>
          </div>

          <div className="panel-content">
            <div className="topic-info">
              <p>{selectedTopic.description}</p>
              <div className="topic-meta">
                <span>Status: {getTopicStatusLabel(selectedTopic.status)}</span>
                <span>Meetings: {selectedTopic.meetingCount || 0}</span>
                <span>First seen: {selectedTopic.firstSeen}</span>
                <span>Last updated: {selectedTopic.lastUpdated}</span>
              </div>
            </div>

            <div className="topic-evolution-history">
              <h5>Evolution History</h5>
              <div className="evolution-timeline">
                {topicHistory.map((event, idx) => (
                  <div key={idx} className="evolution-event">
                    <div className="event-date">
                      {new Date(event.date).toLocaleDateString()}
                    </div>
                    <div className="event-content">
                      <span className="event-type">{event.type}</span>
                      <span className="event-description">
                        {event.description}
                      </span>
                      {event.metrics && (
                        <div className="event-metrics">
                          {Object.entries(event.metrics).map(([key, value]) => (
                            <span key={key} className="metric">
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {topicConnections.length > 0 && (
              <div className="topic-connections">
                <h5>Related Topics</h5>
                <div className="connections-list">
                  {topicConnections
                    .filter(
                      (conn) =>
                        conn.source.id === selectedTopic.id ||
                        conn.target.id === selectedTopic.id
                    )
                    .map((conn, idx) => {
                      const related =
                        conn.source.id === selectedTopic.id
                          ? conn.target
                          : conn.source;
                      return (
                        <button
                          key={idx}
                          type="button"
                          className="connection-item"
                          onClick={() => handleTopicClick(related)}
                        >
                          <span className="connection-name">{related.name}</span>
                          <span
                            className="connection-strength"
                            style={{
                              width: `${conn.strength * 100}%`,
                            }}
                          />
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="panel-actions">
              <button
                type="button"
                className="action-button insights"
                onClick={generateInsights}
              >
                Generate Insights
              </button>
              <button
                type="button"
                className="action-button export"
                onClick={() => {
                  const data = {
                    topic: selectedTopic,
                    history: topicHistory,
                    connections: topicConnections,
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `topic-${selectedTopic.id}-evolution.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export Data
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .cross-meeting-topic-explorer {
          background: #fff;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-top: 20px;
        }

        .explorer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #f0f0f0;
          flex-wrap: wrap;
          gap: 12px;
        }

        .explorer-header h3 {
          margin: 0;
          color: #333;
        }

        .explorer-controls {
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

        .view-toggle {
          padding: 8px 16px;
          background: #4fc3f7;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s;
        }

        .view-toggle:hover {
          background: #39b3e6;
        }

        .topic-stats {
          display: flex;
          gap: 24px;
          margin-bottom: 20px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 600;
          color: #333;
        }

        .stat-label {
          font-size: 12px;
          color: #888;
        }

        .timeline-view {
          max-height: 600px;
          overflow-y: auto;
        }

        .timeline {
          position: relative;
          padding-left: 30px;
        }

        .timeline::before {
          content: '';
          position: absolute;
          left: 8px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #e0e0e0;
        }

        .timeline-item {
          position: relative;
          margin-bottom: 20px;
        }

        .timeline-item::before {
          content: '';
          position: absolute;
          left: -22px;
          top: 4px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #4fc3f7;
          border: 2px solid #fff;
          box-shadow: 0 0 0 2px #4fc3f7;
        }

        .timeline-date {
          font-size: 13px;
          font-weight: 500;
          color: #333;
          margin-bottom: 4px;
        }

        .timeline-time {
          font-weight: 400;
          color: #999;
          margin-left: 8px;
        }

        .timeline-content {
          background: #f8f9fa;
          padding: 12px;
          border-radius: 4px;
        }

        .meeting-name {
          font-weight: 500;
          color: #333;
          margin-bottom: 8px;
        }

        .topic-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .topic-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px 4px 8px;
          background: #fff;
          border: 2px solid;
          border-radius: 16px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }

        .topic-pill:hover {
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .topic-pill.selected {
          background: #e3f2fd;
          border-color: #4fc3f7 !important;
        }

        .topic-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .cluster-view {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .cluster-container {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
        }

        .cluster-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .cluster-header h4 {
          margin: 0;
          color: #333;
        }

        .cluster-count {
          font-size: 13px;
          color: #888;
        }

        .cluster-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }

        .topic-card {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          width: 100%;
        }

        .topic-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .topic-card.selected {
          border-color: #4fc3f7;
          background: #e3f2fd;
        }

        .topic-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .topic-name {
          font-weight: 500;
          color: #333;
        }

        .topic-status {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          color: #fff;
        }

        .topic-card-body {
          margin-bottom: 8px;
        }

        .topic-description {
          margin: 0 0 8px;
          font-size: 13px;
          color: #666;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .topic-keywords {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .keyword-tag {
          font-size: 11px;
          color: #4fc3f7;
          background: #e3f2fd;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .topic-card-footer {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #888;
          padding-top: 8px;
          border-top: 1px solid #e0e0e0;
        }

        .topic-details-panel {
          position: fixed;
          right: 0;
          top: 0;
          width: 480px;
          height: 100%;
          background: #fff;
          box-shadow: -2px 0 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          overflow-y: auto;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e0e0e0;
          position: sticky;
          top: 0;
          background: #fff;
          z-index: 1;
        }

        .panel-header h4 {
          margin: 0;
          color: #333;
        }

        .close-panel {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #888;
          padding: 4px 8px;
        }

        .close-panel:hover {
          color: #333;
        }

        .panel-content {
          padding: 20px;
        }

        .topic-info {
          margin-bottom: 20px;
        }

        .topic-info p {
          color: #666;
          line-height: 1.6;
          margin: 0 0 12px;
        }

        .topic-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          font-size: 13px;
          color: #888;
        }

        .topic-evolution-history {
          margin-bottom: 20px;
        }

        .topic-evolution-history h5,
        .topic-connections h5 {
          margin: 0 0 12px;
          color: #333;
        }

        .evolution-timeline {
          max-height: 300px;
          overflow-y: auto;
        }

        .evolution-event {
          display: flex;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .event-date {
          font-size: 12px;
          color: #888;
          min-width: 80px;
        }

        .event-content {
          flex: 1;
        }

        .event-type {
          display: inline-block;
          padding: 2px 8px;
          background: #e3f2fd;
          border-radius: 12px;
          font-size: 11px;
          color: #4fc3f7;
          margin-right: 8px;
        }

        .event-description {
          font-size: 13px;
          color: #333;
        }

        .event-metrics {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .event-metrics .metric {
          font-size: 11px;
          color: #888;
          background: #f8f9fa;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .connections-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .connection-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #f8f9fa;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
          width: 100%;
          text-align: left;
        }

        .connection-item:hover {
          background: #e3f2fd;
        }

        .connection-name {
          flex: 1;
          color: #333;
          font-size: 13px;
        }

        .connection-strength {
          height: 4px;
          background: #4fc3f7;
          border-radius: 2px;
          transition: width 0.3s;
        }

        .panel-actions {
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

        .action-button.export {
          background: #f0f0f0;
          color: #666;
        }

        .topic-explorer-loading,
        .topic-explorer-error,
        .topic-explorer-empty {
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

CrossMeetingTopicEvolutionExplorer.propTypes = {
  projectId: PropTypes.string.isRequired,
  meetings: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      date: PropTypes.string.isRequired,
    })
  ),
  onTopicSelect: PropTypes.func,
  onInsightGenerate: PropTypes.func,
};

CrossMeetingTopicEvolutionExplorer.defaultProps = {
  meetings: [],
  onTopicSelect: null,
  onInsightGenerate: null,
};

export default CrossMeetingTopicEvolutionExplorer;
