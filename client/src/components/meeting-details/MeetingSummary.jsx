import React, { useState } from "react";
import SummarySection from "./SummarySection";
import DecisionCard from "./DecisionCard";
import ActionItemCard from "./ActionItemCard";
import MeetingStats from "./MeetingStats";
import GlossaryHighlighter from "./GlossaryHighlighter";

const MeetingSummary = ({ meeting }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!meeting) return null;

  const summary = meeting.summary || meeting.structuredMoM || null;

  if (!summary) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          AI Summary
        </h2>
        <div className="text-gray-500 text-sm py-8 text-center bg-gray-50 rounded-lg">
          <p>No summary available yet.</p>
          <p className="text-xs mt-1">
            Generate a summary to view AI insights.
          </p>
        </div>
      </div>
    );
  }

  const renderStructuredSummary = (structured) => {
    if (!structured) return null;

    return (
      <div className="space-y-4">
        <SummarySection
          title="Executive Summary"
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        >
          <div className="whitespace-pre-wrap">
            <GlossaryHighlighter text={structured.summary} />
          </div>
        </SummarySection>

        {structured.agenda && structured.agenda.length > 0 && (
          <SummarySection
            title="Agenda"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            }
          >
            <ul className="list-disc list-inside space-y-1">
              {structured.agenda.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </SummarySection>
        )}

        {structured.key_discussions &&
          structured.key_discussions.length > 0 && (
            <SummarySection
              title="Key Discussion Points"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              }
            >
              <ul className="list-disc list-inside space-y-1">
                {structured.key_discussions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </SummarySection>
          )}

        {structured.decisions && structured.decisions.length > 0 && (
          <SummarySection
            title="Decisions Made"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          >
            <div className="space-y-2">
              {structured.decisions.map((decision, index) => (
                <DecisionCard key={index} decision={decision} index={index} />
              ))}
            </div>
          </SummarySection>
        )}

        {structured.action_items && structured.action_items.length > 0 && (
          <SummarySection
            title="Action Items"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            }
          >
            <div className="space-y-2">
              {structured.action_items.map((item, index) => (
                <ActionItemCard key={index} actionItem={item} index={index} />
              ))}
            </div>
          </SummarySection>
        )}

        {structured.questions_raised &&
          structured.questions_raised.length > 0 && (
            <SummarySection
              title="Questions Raised"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            >
              <ul className="list-disc list-inside space-y-1">
                {structured.questions_raised.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </SummarySection>
          )}

        {structured.keywords && structured.keywords.length > 0 && (
          <SummarySection
            title="Keywords"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            }
          >
            <div className="flex flex-wrap gap-2">
              {structured.keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </SummarySection>
        )}

        {structured.attendees && structured.attendees.length > 0 && (
          <SummarySection
            title="Attendees"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
          >
            <p>{structured.attendees.join(", ")}</p>
          </SummarySection>
        )}

        {structured.notes && (
          <SummarySection
            title="Notes"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            }
          >
            <p className="whitespace-pre-wrap">{structured.notes}</p>
          </SummarySection>
        )}
      </div>
    );
  };

  const summaryText = typeof summary === "string" ? summary : null;
  const shouldShowExpandButton = summaryText && summaryText.length > 500;

  const truncateAtWord = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    const lastSpace = text.lastIndexOf(" ", maxLength);
    return text.substring(0, lastSpace > 0 ? lastSpace : maxLength) + "...";
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          AI Summary
        </h2>

        <div className="text-gray-700 text-sm">
          {typeof summary === "object" ? (
            renderStructuredSummary(summary)
          ) : (
            <div className="whitespace-pre-wrap">
              {shouldShowExpandButton && !isExpanded ? (
                <>
                  <GlossaryHighlighter
                    text={truncateAtWord(summaryText, 500)}
                  />
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="ml-2 text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Read more
                  </button>
                </>
              ) : (
                <>
                  <GlossaryHighlighter text={summaryText} />
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
            </div>
          )}
        </div>
      </div>

      <MeetingStats meeting={meeting} />
    </>
  );
};

export default MeetingSummary;
