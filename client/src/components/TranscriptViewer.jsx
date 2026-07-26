import React, { useState, useEffect } from "react";
import { Search, Clock, User } from "lucide-react";
import axios from "axios";

const TranscriptViewer = ({ meetingId }) => {
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [filteredSegments, setFilteredSegments] = useState([]);

  useEffect(() => {
    const fetchTranscript = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(
          `/api/meetings/${meetingId}/transcript`,
          { withCredentials: true }
        );

        if (data.success) {
          setTranscript(data.transcript);
        }
      } catch (error) {
        console.error("Error fetching transcript:", error);
      } finally {
        setLoading(false);
      }
    };

    if (meetingId) {
      fetchTranscript();
    }
  }, [meetingId]);

  useEffect(() => {
    if (!transcript || !transcript.segments) {
      setFilteredSegments([]);
      return;
    }

    if (!filter.trim()) {
      setFilteredSegments(transcript.segments);
      return;
    }

    const filtered = transcript.segments.filter((segment) =>
      segment.text.toLowerCase().includes(filter.toLowerCase()) ||
      segment.speaker.toLowerCase().includes(filter.toLowerCase())
    );
    setFilteredSegments(filtered);
  }, [transcript, filter]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const jumpToTimestamp = (timestamp) => {
    // This would integrate with a video/audio player if available
    console.log("Jump to timestamp:", timestamp);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500 text-center py-8">No transcript available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Meeting Transcript</h3>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              transcript.status === "completed"
                ? "bg-green-100 text-green-700"
                : transcript.status === "processing"
                ? "bg-yellow-100 text-yellow-700"
                : transcript.status === "failed"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {transcript.status.charAt(0).toUpperCase() + transcript.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Search/Filter */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transcript..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Transcript Segments */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {filteredSegments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {filter ? "No matching segments found" : "No transcript segments available"}
          </p>
        ) : (
          filteredSegments.map((segment, index) => (
            <div
              key={index}
              className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
              onClick={() => jumpToTimestamp(segment.startTime)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-600">
                    {segment.speaker || "Unknown"}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    jumpToTimestamp(segment.startTime);
                  }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                >
                  <Clock className="w-3 h-3" />
                  {formatTime(segment.startTime)}
                </button>
              </div>
              <p className="text-sm text-gray-700">{segment.text}</p>
              {segment.confidence && (
                <div className="mt-1">
                  <div className="w-full bg-gray-200 rounded-full h-1">
                    <div
                      className="bg-blue-600 h-1 rounded-full"
                      style={{ width: `${segment.confidence * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Full Text View Toggle */}
      {transcript.fullText && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => {
              const blob = new Blob([transcript.fullText], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `transcript-${meetingId}.txt`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Download Full Transcript
          </button>
        </div>
      )}
    </div>
  );
};

export default TranscriptViewer;
