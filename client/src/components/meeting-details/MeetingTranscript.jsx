import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ExternalLink } from "lucide-react";

const MeetingTranscript = ({ meeting }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  if (!meeting) return null;

  const transcript = meeting.transcript || "";

  if (!transcript) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText size={20} />
          Full Transcript
        </h2>
        <div className="text-gray-500 text-sm py-8 text-center bg-gray-50 rounded-lg">
          <p>No transcript available.</p>
          <p className="text-xs mt-1">Upload audio to generate a transcript.</p>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      alert("Transcript copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const shouldShowExpandButton = transcript.length > 1000;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText size={20} />
          Full Transcript
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/transcript/${meeting._id}`)}
            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 px-3 py-1 rounded-md hover:bg-indigo-50 transition-colors"
          >
            <ExternalLink size={14} />
            View Full Transcript
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 px-3 py-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            Copy
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
        <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
          {shouldShowExpandButton && !isExpanded ? (
            <>
              {transcript.substring(0, 1000)}...
              <button
                onClick={() => setIsExpanded(true)}
                className="ml-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                Read more
              </button>
            </>
          ) : (
            <>
              {transcript}
              {shouldShowExpandButton && isExpanded && (
                <button
                  onClick={() => setIsExpanded(false)}
                  className="ml-2 text-blue-600 hover:text-blue-800 font-medium"
                >
                  Show less
                </button>
              )}
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default MeetingTranscript;
