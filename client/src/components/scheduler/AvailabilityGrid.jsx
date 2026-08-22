import React, { useMemo, useCallback } from "react";
import { format, differenceInMinutes } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Clock, Users, AlertCircle, RefreshCw, Zap, Calendar, Info } from "lucide-react";

/**
 * @desc Visual grid displaying ranked time slot proposals.
 * Shows optimality scores, conflict warnings, and allows quick confirmation.
 * Production-hardened with timezone support, detailed conflict visualization,
 * error states, and calendar integration.
 */
const AvailabilityGrid = ({
  proposals = [],
  onConfirm,
  onHandoff,
  isLoading = false,
  participants = [],
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  meetingDuration = 30,
  onSlotSelect,
  isSchedulerWizard = false,
  onTimeChange,
  isConnected = true,
  onConnectCalendar,
  className = "",
  showDetailedConflicts = true
}) => {
  // State management
  const [selectedSlot, setSelectedSlot] = React.useState(null);
  const [hoveredSlot, setHoveredSlot] = React.useState(null);
  const [currentView, setCurrentView] = React.useState('list'); // 'list' | 'grid'
  const [expandedConflicts, setExpandedConflicts] = React.useState({});
  const [error, setError] = React.useState(null);
  const [retryCount, setRetryCount] = React.useState(0);

  // Validate and normalize proposals
  const safeProposals = useMemo(() => {
    if (!Array.isArray(proposals)) return [];
    return proposals.filter(p => p && typeof p === 'object');
  }, [proposals]);

  // Process proposals with enhanced conflict detection
  const processedProposals = useMemo(() => {
    return safeProposals.map((slot, index) => {
      const startTime = new Date(slot.startTime);
      const endTime = new Date(slot.endTime);
      const duration = differenceInMinutes(endTime, startTime);
      
      // Enhanced conflict analysis
      const conflicts = slot.conflicts || [];
      const conflictDetails = conflicts.map(conflict => ({
        ...conflict,
        severity: conflict.severity || 'medium',
        participants: conflict.participants || [],
        time: conflict.time || startTime
      }));

      // Calculate availability metrics
      const totalParticipants = Math.max(slot.attendeeCount || 0, participants.length || 0);
      const availableCount = slot.attendeeCount || 0;
      const availabilityPercentage = totalParticipants > 0 
        ? Math.round((availableCount / totalParticipants) * 100)
        : 0;

      // Determine slot status
      let status = 'available';
      if (conflicts.length > 0 && conflicts.length >= totalParticipants / 2) {
        status = 'conflicted';
      } else if (conflicts.length > 0) {
        status = 'partial';
      } else if (availabilityPercentage < 50) {
        status = 'limited';
      }

      return {
        ...slot,
        id: slot.id || `slot-${index}`,
        startTime,
        endTime,
        duration,
        conflicts: conflictDetails,
        totalParticipants,
        availableCount,
        availabilityPercentage,
        status,
        isOptimal: slot.score >= 80,
        isGood: slot.score >= 50 && slot.score < 80,
        isPoor: slot.score < 50
      };
    });
  }, [safeProposals, participants]);

  // Get optimal slots (score >= 80)
  const optimalSlots = useMemo(() => {
    return processedProposals.filter(slot => slot.isOptimal);
  }, [processedProposals]);

  // Get best slot (highest score)
  const bestSlot = useMemo(() => {
    if (processedProposals.length === 0) return null;
    return processedProposals.reduce((best, current) => 
      current.score > best.score ? current : best
    );
  }, [processedProposals]);

  // Format time with timezone
  const formatTime = useCallback((date, formatType = 'time') => {
    if (!date) return '';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const zonedDate = toZonedTime(dateObj, timeZone);
      
      if (formatType === 'time') {
        return format(zonedDate, 'h:mm a');
      } else if (formatType === 'date') {
        return format(zonedDate, 'EEE, MMM d');
      } else if (formatType === 'full') {
        return format(zonedDate, 'EEEE, MMMM d, yyyy h:mm a');
      } else if (formatType === 'short') {
        return format(zonedDate, 'MMM d, h:mm a');
      }
      return format(zonedDate, 'h:mm a');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }, [timeZone]);

  // Get score color based on value
  const getScoreColor = useCallback((score) => {
    if (score >= 80) {
      return {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-700 dark:text-green-300",
        border: "border-green-200 dark:border-green-800",
        badge: "bg-green-500"
      };
    }
    if (score >= 50) {
      return {
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-700 dark:text-yellow-300",
        border: "border-yellow-200 dark:border-yellow-800",
        badge: "bg-yellow-500"
      };
    }
    return {
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-300",
      border: "border-red-200 dark:border-red-800",
      badge: "bg-red-500"
    };
  }, []);

  // Get status icon
  const getStatusIcon = useCallback((status) => {
    switch(status) {
      case 'available':
        return <Zap className="w-4 h-4 text-green-500" />;
      case 'conflicted':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'partial':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'limited':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  }, []);

  // Handle slot confirmation
  const handleConfirm = useCallback((slot) => {
    if (isLoading) return;
    
    // Check if slot has conflicts
    if (slot.status === 'conflicted') {
      setError('This slot has significant conflicts. Please review conflicts before confirming.');
      return;
    }

    setSelectedSlot(slot);
    if (onConfirm) {
      onConfirm(slot);
    }
    if (onSlotSelect) {
      onSlotSelect(slot);
    }
  }, [isLoading, onConfirm, onSlotSelect]);

  // Handle slot customization
  const handleCustomize = useCallback((slot) => {
    if (onHandoff) {
      onHandoff(slot);
    }
  }, [onHandoff]);

  // Toggle conflict details
  const toggleConflictDetails = useCallback((slotId) => {
    setExpandedConflicts(prev => ({
      ...prev,
      [slotId]: !prev[slotId]
    }));
  }, []);

  // Handle retry
  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setError(null);
    // Trigger refresh - parent component should handle this
    if (onTimeChange) {
      onTimeChange(new Date());
    }
  }, [onTimeChange]);

  // Render disconnected state
  if (!isConnected) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 ${className}`}>
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Connect Your Calendar
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            To view availability and find optimal meeting times, please connect your calendar account.
            This allows us to check your schedule and avoid conflicts.
          </p>
          <button
            onClick={onConnectCalendar}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <Calendar className="w-5 h-5" />
            Connect Calendar
          </button>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            We never share your calendar data without your permission
          </p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 ${className}`}>
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Unable to Load Availability
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            {retryCount < 3 && (
              <button
                onClick={() => {
                  setRetryCount(prev => prev + 1);
                  handleRetry();
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Retry ({3 - retryCount} left)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                  </div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </div>
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render empty state
  if (processedProposals.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 ${className}`}>
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Optimal Slots Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            We couldn&apos;t find any optimal meeting times based on everyone&apos;s availability.
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Try these suggestions:
            </p>
            <ul className="text-sm text-left text-gray-500 dark:text-gray-400 space-y-1 max-w-xs mx-auto">
              <li>• Expand the date range</li>
              <li>• Add more time slots</li>
              <li>• Relax participant availability requirements</li>
              <li>• Check if participants have connected their calendars</li>
            </ul>
          </div>
          <button
            onClick={handleRetry}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Availability
          </button>
        </div>
      </div>
    );
  }

  // Render legend
  const renderLegend = () => (
    <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg mb-4">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-green-500"></div>
        <span className="text-sm text-gray-600 dark:text-gray-300">Optimal (80%+)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-yellow-500"></div>
        <span className="text-sm text-gray-600 dark:text-gray-300">Good (50-79%)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-red-500"></div>
        <span className="text-sm text-gray-600 dark:text-gray-300">Low (&lt;50%)</span>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <Clock className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {timeZone}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {meetingDuration} min meeting
        </span>
      </div>
      <button
        onClick={() => setCurrentView(prev => prev === 'list' ? 'grid' : 'list')}
        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        Switch to {currentView === 'list' ? 'Grid' : 'List'} View
      </button>
    </div>
  );

  // Render best slot highlight
  const renderBestSlotBanner = () => {
    if (!bestSlot) return null;
    
    return (
      <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Best Time: {formatTime(bestSlot.startTime, 'full')}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {bestSlot.availableCount} available · {bestSlot.score}% match
              </p>
            </div>
          </div>
          <button
            onClick={() => handleConfirm(bestSlot)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Confirm Best Time
          </button>
        </div>
      </div>
    );
  };

  // Render conflict details
  const renderConflictDetails = (slot) => {
    if (!showDetailedConflicts || !slot.conflicts || slot.conflicts.length === 0) {
      return null;
    }

    const isExpanded = expandedConflicts[slot.id];
    const conflictCount = slot.conflicts.length;

    return (
      <div className="mt-2">
        <button
          onClick={() => toggleConflictDetails(slot.id)}
          className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 flex items-center gap-1"
        >
          <AlertCircle className="w-3 h-3" />
          {conflictCount} conflict{conflictCount > 1 ? 's' : ''} {isExpanded ? '▲' : '▼'}
        </button>
        {isExpanded && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs space-y-1">
            {slot.conflicts.map((conflict, idx) => (
              <div key={idx} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                <span className="text-red-500">•</span>
                <div>
                  <span className="font-medium">{conflict.participants?.join(', ') || 'Participant'}</span>
                  {conflict.time && (
                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                      at {formatTime(conflict.time, 'time')}
                    </span>
                  )}
                  {conflict.severity && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded ${
                      conflict.severity === 'high' ? 'bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300' :
                      conflict.severity === 'medium' ? 'bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300' :
                      'bg-yellow-200 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300'
                    }`}>
                      {conflict.severity}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render list view
  const renderListView = () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {processedProposals.map((slot) => {
        const colors = getScoreColor(slot.score);
        const isBestSlot = bestSlot && slot.id === bestSlot.id;
        const isSelected = selectedSlot && slot.id === selectedSlot.id;

        return (
          <div
            key={slot.id}
            className={`rounded-lg border p-4 transition-all ${
              isBestSlot ? 'border-green-400 dark:border-green-600 bg-green-50/50 dark:bg-green-900/10' :
              isSelected ? 'border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10' :
              'border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800'
            } ${className}`}
            onMouseEnter={() => setHoveredSlot(slot)}
            onMouseLeave={() => setHoveredSlot(null)}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {formatTime(slot.startTime, 'date')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {formatTime(slot.startTime, 'time')} - {formatTime(slot.endTime, 'time')}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {slot.duration} minutes
                </p>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${colors.bg} ${colors.text}`}
                >
                  {slot.score}% Match
                </div>
                {isBestSlot && (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    ★ Best
                  </span>
                )}
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {slot.availableCount} / {slot.totalParticipants} available
              </span>
              {slot.conflicts && slot.conflicts.length > 0 && (
                <span className="font-medium text-red-600 dark:text-red-400">
                  {slot.conflicts.length} conflict{slot.conflicts.length > 1 ? 's' : ''}
                </span>
              )}
              <span className="flex items-center gap-1">
                {getStatusIcon(slot.status)}
                <span className="capitalize">{slot.status}</span>
              </span>
            </div>

            {renderConflictDetails(slot)}

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleConfirm(slot)}
                disabled={isLoading || slot.status === 'conflicted'}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors ${
                  slot.status === 'conflicted'
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                } disabled:opacity-50`}
              >
                {slot.status === 'conflicted' ? 'Has Conflicts' : 'Confirm Meeting'}
              </button>
              {onHandoff && (
                <button
                  type="button"
                  onClick={() => handleCustomize(slot)}
                  disabled={isLoading}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-slate-700 disabled:opacity-50"
                  title="Customize in full meeting form"
                >
                  Customize
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Render grid view (compact)
  const renderGridView = () => (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="grid grid-cols-4 gap-2">
          {processedProposals.map((slot) => {
            const colors = getScoreColor(slot.score);
            const isBestSlot = bestSlot && slot.id === bestSlot.id;
            
            return (
              <div
                key={slot.id}
                className={`rounded-lg border p-3 text-center cursor-pointer transition-all hover:shadow-md ${
                  isBestSlot ? 'border-green-400 dark:border-green-600 bg-green-50/50 dark:bg-green-900/10' :
                  'border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800'
                }`}
                onClick={() => handleConfirm(slot)}
              >
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {formatTime(slot.startTime, 'date')}
                </div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatTime(slot.startTime, 'time')}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  - {formatTime(slot.endTime, 'time')}
                </div>
                <div
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${colors.bg} ${colors.text} mb-1`}
                >
                  {slot.score}%
                </div>
                <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Users className="w-3 h-3" />
                  {slot.availableCount}/{slot.totalParticipants}
                </div>
                {isBestSlot && (
                  <div className="mt-1 text-xs font-medium text-green-600 dark:text-green-400">
                    ★ Best
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          Top Recommended Times ({processedProposals.length} found)
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Clock className="w-4 h-4" />
          <span>{timeZone}</span>
        </div>
      </div>

      {renderLegend()}
      {renderBestSlotBanner()}

      {currentView === 'list' ? renderListView() : renderGridView()}

      {/* Summary stats */}
      {processedProposals.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {optimalSlots.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Optimal</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {processedProposals.filter(s => s.status === 'available').length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Available</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {processedProposals.filter(s => s.conflicts && s.conflicts.length > 0).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Has Conflicts</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {bestSlot ? `${bestSlot.score}%` : 'N/A'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Best Match</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailabilityGrid;
