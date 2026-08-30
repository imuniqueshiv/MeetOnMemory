import React, { useState, useEffect } from 'react';
import useIcebreaker from '../hooks/useIcebreaker';
import { Loader2, Sparkles, Send, X, Users, Clock, BarChart3 } from 'lucide-react';

const LiveIcebreakerBanner = ({ meetingId, onClose }) => {
  const [showResponse, setShowResponse] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [customResponse, setCustomResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responseError, setResponseError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const {
    loading,
    error,
    activeIcebreaker,
    history,
    generateIcebreaker,
    selectIcebreaker,
    submitResponse,
    hasActiveIcebreaker,
    hasResponded,
    fetchActiveIcebreaker,
  } = useIcebreaker(meetingId);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveIcebreaker();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchActiveIcebreaker]);

  const handleGenerate = async () => {
    try {
      const icebreaker = await generateIcebreaker({
        type: 'icebreaker_question',
        difficulty: 'medium',
      });
      if (icebreaker) {
        await selectIcebreaker(icebreaker._id);
        setShowResponse(true);
      }
    } catch (err) {
      console.error('Generate failed:', err);
    }
  };

  const handleSelectAndRespond = async (icebreakerId) => {
    try {
      await selectIcebreaker(icebreakerId);
      setShowResponse(true);
    } catch (err) {
      console.error('Select failed:', err);
    }
  };

  const handleSubmitResponse = async () => {
    const answer = selectedAnswer || customResponse;
    if (!answer.trim()) {
      setResponseError('Please provide an answer');
      return;
    }

    setIsSubmitting(true);
    setResponseError(null);

    try {
      await submitResponse(activeIcebreaker._id, answer);
      setShowResponse(false);
      setSelectedAnswer('');
      setCustomResponse('');
    } catch (err) {
      setResponseError(err.error || 'Failed to submit response');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (loading && !activeIcebreaker) {
    return (
      <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg border border-gray-200">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600">Loading icebreaker...</span>
      </div>
    );
  }

  // Error state - distinguishable 404 vs other errors
  if (error) {
    const isNotFound = error.includes('not found') || error.includes('No active');
    return (
      <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-yellow-600" />
            <div>
              <h3 className="font-medium text-yellow-800">
                {isNotFound ? 'No Active Icebreaker' : 'Icebreaker Error'}
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                {isNotFound 
                  ? 'Start the meeting with an icebreaker to engage participants!'
                  : error
                }
              </p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
          >
            Generate Icebreaker
          </button>
        </div>
      </div>
    );
  }

  // No active icebreaker - show generate option
  if (!activeIcebreaker) {
    return (
      <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-blue-500" />
            <div>
              <h3 className="font-semibold text-gray-800">Icebreaker Time!</h3>
              <p className="text-sm text-gray-600 mt-1">
                Start your meeting with an engaging icebreaker
              </p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Generate
          </button>
        </div>
      </div>
    );
  }

  // Active icebreaker display
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h3 className="font-semibold text-gray-800">Icebreaker Activity</h3>
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
              {activeIcebreaker.type?.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {activeIcebreaker.responses?.length || 0} responses
            </span>
            {activeIcebreaker.expiresAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(activeIcebreaker.expiresAt).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            {onClose && (
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="px-6 py-4">
        <p className="text-lg font-medium text-gray-800">{activeIcebreaker.question}</p>
        
        {/* Options */}
        {activeIcebreaker.options && activeIcebreaker.options.length > 0 && (
          <div className="mt-4 space-y-2">
            {activeIcebreaker.options.map((option, index) => (
              <button
                key={index}
                onClick={() => setSelectedAnswer(option)}
                className={`w-full text-left px-4 py-2 rounded-lg border transition-colors ${
                  selectedAnswer === option
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {/* Custom response input */}
        <div className="mt-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={customResponse}
              onChange={(e) => setCustomResponse(e.target.value)}
              placeholder={activeIcebreaker.options?.length > 0 
                ? 'Or type your own response...' 
                : 'Type your response...'
              }
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isSubmitting || hasResponded}
            />
            <button
              onClick={handleSubmitResponse}
              disabled={isSubmitting || hasResponded || (!selectedAnswer && !customResponse.trim())}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Respond
            </button>
          </div>
          {responseError && (
            <p className="mt-2 text-sm text-red-600">{responseError}</p>
          )}
          {hasResponded && (
            <p className="mt-2 text-sm text-green-600">✓ You've responded to this icebreaker!</p>
          )}
        </div>

        {/* History toggle */}
        {showHistory && history.length > 0 && (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Past Icebreakers</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {history.slice(0, 5).map((item) => (
                <div key={item._id} className="text-sm p-2 bg-gray-50 rounded">
                  <p className="text-gray-600">{item.question}</p>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{item.type}</span>
                    <span>{item.responses?.length || 0} responses</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleGenerate}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Generate New
          </button>
          {history.length > 0 && (
            <button
              onClick={() => {
                const lastIcebreaker = history[history.length - 1];
                if (lastIcebreaker) {
                  handleSelectAndRespond(lastIcebreaker._id);
                }
              }}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium ml-2"
            >
              Reuse Previous
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveIcebreakerBanner;