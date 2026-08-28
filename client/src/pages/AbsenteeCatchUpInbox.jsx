import React, { useState } from "react";
import { useAbsenteeCatchUp } from "../hooks/useAbsenteeCatchUp";

const AbsenteeCatchUpInbox = () => {
  const { catchUps, isLoading, isError, markAsRead } = useAbsenteeCatchUp();
  const [expandedId, setExpandedId] = useState(null);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading your catch-ups...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-red-500">
        Failed to load catch-ups.
      </div>
    );
  }

  if (catchUps.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <h2 className="text-xl font-semibold mb-2">You're all caught up!</h2>
        <p>You have no pending meeting catch-ups to read.</p>
      </div>
    );
  }

  const handleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleMarkAsRead = (e, id) => {
    e.stopPropagation();
    markAsRead(id);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Your Catch-Up Inbox
      </h1>
      <p className="mb-6 text-gray-600">
        Personalized digests for meetings you missed.
      </p>

      <div className="space-y-4">
        {catchUps.map((catchUp) => {
          const isExpanded = expandedId === catchUp._id;
          const meeting = catchUp.meetingId;
          const content = catchUp.content || {};

          return (
            <div
              key={catchUp._id}
              className={`border rounded-lg shadow-sm bg-white transition-all duration-200 ${isExpanded ? "ring-2 ring-blue-500" : "hover:border-blue-300 cursor-pointer"}`}
              onClick={() => handleExpand(catchUp._id)}
            >
              {/* Header */}
              <div className="p-4 flex justify-between items-center border-b">
                <div>
                  <h3 className="font-semibold text-lg text-gray-800">
                    {meeting?.title || "Unknown Meeting"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {meeting?.date
                      ? new Date(meeting.date).toLocaleDateString()
                      : "Unknown Date"}
                  </p>
                </div>
                <div className="flex space-x-3 items-center">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${catchUp.status === "read" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"}`}
                  >
                    {catchUp.status}
                  </span>
                  {catchUp.status !== "read" && (
                    <button
                      onClick={(e) => handleMarkAsRead(e, catchUp._id)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="p-5 bg-gray-50">
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-700 mb-1">
                      General Summary
                    </h4>
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                      {meeting?.summary || "No general summary available."}
                    </p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold text-blue-800 mb-1">
                      Your Personalized Catch-Up
                    </h4>
                    <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed bg-blue-50 p-3 rounded border border-blue-100">
                      {content.catchUpReport ||
                        "No personalized report generated."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {content.actionItemsAssigned &&
                      content.actionItemsAssigned.length > 0 && (
                        <div className="bg-orange-50 p-3 rounded border border-orange-100">
                          <h4 className="font-semibold text-orange-800 mb-2 text-sm">
                            Action Items Assigned To You
                          </h4>
                          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                            {content.actionItemsAssigned.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {content.keyTakeaways &&
                      content.keyTakeaways.length > 0 && (
                        <div className="bg-green-50 p-3 rounded border border-green-100">
                          <h4 className="font-semibold text-green-800 mb-2 text-sm">
                            Key Takeaways
                          </h4>
                          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                            {content.keyTakeaways.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AbsenteeCatchUpInbox;
