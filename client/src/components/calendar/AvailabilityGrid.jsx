// src/components/calendar/AvailabilityGrid.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

const useCalendar = () => {
  return {
    calendars: [],
    isConnected: false,
    connectCalendar: () => {},
  };
};

const useTimeZone = () => {
  return {
    userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    availableTimeZones: [],
  };
};

const CalendarConnectCTA = ({ onConnect, message }) => (
  <div>
    <button onClick={onConnect}>{message}</button>
  </div>
);

const SchedulerWizard = ({ selectedTime, participants, duration, timeZone, onSchedule }) => (
  <div>
    <h4>Schedule Meeting</h4>
    <p>Time: {selectedTime?.toLocaleString()}</p>
    <button onClick={() => onSchedule({ time: selectedTime, participants, duration, timeZone })}>
      Schedule
    </button>
  </div>
);

const AvailabilityGrid = ({
  participants = [],
  dateRange = null,
  onTimeSelect = null,
  meetingDuration = 30,
}) => {
  const { isConnected, connectCalendar } = useCalendar();
  const { userTimeZone } = useTimeZone();
  const [selectedTime, setSelectedTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [freeBusyData, setFreeBusyData] = useState({});

  useEffect(() => {
    const fetchFreeBusy = async () => {
      if (!isConnected || participants.length === 0) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/calendar/freebusy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            participants: participants.map((p) => p.email),
            startTime: dateRange?.start,
            endTime: dateRange?.end,
            timeZone: userTimeZone,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch calendar availability');
        }

        const data = await response.json();
        setFreeBusyData(data);
      } catch (err) {
        setError(err.message);
        console.error('FreeBusy fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFreeBusy();
  }, [participants, dateRange, isConnected, userTimeZone]);

  const conflictMap = useMemo(() => {
    const conflicts = {};

    if (!freeBusyData || Object.keys(freeBusyData).length === 0) {
      return conflicts;
    }

    const timeSlots = {};
    const startTime = new Date(dateRange?.start);
    const endTime = new Date(dateRange?.end);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return conflicts;
    }

    for (let time = new Date(startTime); time < endTime; time.setMinutes(time.getMinutes() + 15)) {
      const key = time.toISOString();
      timeSlots[key] = {
        time: new Date(time),
        participants: {},
        conflictCount: 0,
        isFree: true,
      };
    }

    Object.entries(freeBusyData).forEach(([email, busyIntervals]) => {
      if (!Array.isArray(busyIntervals)) {
        return;
      }
      busyIntervals.forEach((interval) => {
        const start = new Date(interval.start);
        const end = new Date(interval.end);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return;
        }

        for (let time = new Date(start); time < end; time.setMinutes(time.getMinutes() + 15)) {
          const key = time.toISOString();
          if (timeSlots[key]) {
            timeSlots[key].participants[email] = true;
            timeSlots[key].conflictCount += 1;
            timeSlots[key].isFree = false;
          }
        }
      });
    });

    Object.entries(timeSlots).forEach(([key, slot]) => {
      if (slot.conflictCount > 1) {
        conflicts[key] = {
          ...slot,
          severity: slot.conflictCount / participants.length,
          isOverlap: true,
        };
      }
    });

    return conflicts;
  }, [freeBusyData, dateRange, participants]);

  const handleTimeSelect = useCallback(
    (time) => {
      setSelectedTime(time);
      if (onTimeSelect) {
        onTimeSelect(time);
      }
    },
    [onTimeSelect]
  );

  const handleKeyDown = useCallback(
    (e, time, isBusy, isConflict) => {
      if (e.key === 'Enter' && !isBusy && !isConflict) {
        handleTimeSelect(time);
      }
    },
    [handleTimeSelect]
  );

  if (!isConnected) {
    return (
      <div className="availability-grid-disconnected">
        <CalendarConnectCTA
          onConnect={connectCalendar}
          message="Connect your calendar to see availability"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="availability-grid-error">
        <div className="error-icon">⚠️</div>
        <h3>Unable to load availability</h3>
        <p>{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="retry-button"
        >
          Retry
        </button>
        <div className="error-help">
          <p>Make sure your calendar is properly connected and try again.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="availability-grid-loading">
        <div className="spinner" />
        <p>Loading calendar availability for {participants.length} participant(s)...</p>
      </div>
    );
  }

  if (!freeBusyData || Object.keys(freeBusyData).length === 0) {
    return (
      <div className="availability-grid-empty">
        <div className="empty-icon">📅</div>
        <h3>No availability data</h3>
        <p>We couldn&apos;t find any calendar data for the selected participants.</p>
        <p className="empty-hint">
          Try selecting a different date range or ensure all participants have connected
          calendars.
        </p>
      </div>
    );
  }

  return (
    <div className="availability-grid-container">
      <div className="availability-grid-header">
        <div className="timezone-display">
          <span className="timezone-label">🌐 Timezone:</span>
          <span className="timezone-value">{userTimeZone}</span>
          <button
            type="button"
            className="change-timezone-button"
            onClick={() => {}}
          >
            Change
          </button>
        </div>

        <div className="legend">
          <div className="legend-item">
            <span className="legend-color free" />
            <span>Free</span>
          </div>
          <div className="legend-item">
            <span className="legend-color busy" />
            <span>Busy</span>
          </div>
          <div className="legend-item">
            <span className="legend-color conflict" />
            <span>Conflict</span>
          </div>
          <div className="legend-item participant-count">
            <span>{participants.length} participant(s)</span>
          </div>
        </div>
      </div>

      <div className="availability-grid">
        <div className="grid-header">
          <div className="time-column">Time</div>
          {participants.map((participant, idx) => (
            <div key={idx} className="participant-column">
              <div className="participant-name" title={participant.email}>
                {participant.name || participant.email.split('@')[0]}
              </div>
            </div>
          ))}
          <div className="conflict-column">Status</div>
        </div>

        {Object.entries(conflictMap).map(([key, slot]) => {
          const isConflict = slot.isOverlap;
          const isBusy = !slot.isFree && !isConflict;
          const conflictSeverity = slot.severity || 0;

          return (
            <div
              key={key}
              className={`grid-row ${isConflict ? 'conflict-row' : ''} ${
                isBusy ? 'busy-row' : ''
              }`}
              onClick={() => {
                if (!isBusy && !isConflict) {
                  handleTimeSelect(slot.time);
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, slot.time, isBusy, isConflict)}
              role="button"
              tabIndex={0}
            >
              <div className="time-column">
                {slot.time.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>

              {participants.map((participant, idx) => (
                <div key={idx} className="participant-column">
                  <div
                    className={`availability-indicator ${
                      slot.participants[participant.email] ? 'busy' : 'free'
                    }`}
                  >
                    {slot.participants[participant.email] ? '🔴' : '🟢'}
                  </div>
                </div>
              ))}

              <div className="conflict-column">
                {isConflict ? (
                  <div
                    className="conflict-indicator"
                    style={{
                      backgroundColor: `rgba(255, 0, 0, ${Math.min(conflictSeverity, 1)})`,
                    }}
                  >
                    {Math.round(conflictSeverity * 100)}% conflict
                  </div>
                ) : isBusy ? (
                  <span className="busy-text">Busy</span>
                ) : (
                  <button
                    type="button"
                    className="select-time-button"
                    onClick={() => handleTimeSelect(slot.time)}
                  >
                    Select
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTime && (
        <div className="availability-grid-footer">
          <SchedulerWizard
            selectedTime={selectedTime}
            participants={participants}
            duration={meetingDuration}
            timeZone={userTimeZone}
            onSchedule={(meetingDetails) => {
              console.log('Scheduling meeting:', meetingDetails);
            }}
          />
        </div>
      )}
    </div>
  );
};

AvailabilityGrid.propTypes = {
  participants: PropTypes.arrayOf(
    PropTypes.shape({
      email: PropTypes.string.isRequired,
      name: PropTypes.string,
    })
  ),
  dateRange: PropTypes.shape({
    start: PropTypes.string,
    end: PropTypes.string,
  }),
  onTimeSelect: PropTypes.func,
  meetingDuration: PropTypes.number,
};

AvailabilityGrid.defaultProps = {
  participants: [],
  dateRange: null,
  onTimeSelect: null,
  meetingDuration: 30,
};

export default AvailabilityGrid;
