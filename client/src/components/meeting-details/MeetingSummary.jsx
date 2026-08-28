import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import SummarySection from "./SummarySection";
import DecisionCard from "./DecisionCard";
import ActionItemCard from "./ActionItemCard";
import MeetingStats from "./MeetingStats";
import GlossaryHighlighter from "./GlossaryHighlighter";
import NoteVersionHistory from "../NoteVersionHistory";
import PrintMomModal from "../meetings/PrintMomModal.jsx";
import { meetingApi, aiSummaryTemplateApi } from "../../services";

const MeetingSummary = ({ meeting, onSummaryUpdated }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [currentSummary, setCurrentSummary] = useState(
    meeting?.summary || meeting?.structuredMoM || null,
  );

  // Template Modal & History Modal state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [setSelectedTemplate] = useState(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Confirmation Overwrite Dialog state
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  useEffect(() => {
    setCurrentSummary(meeting?.summary || meeting?.structuredMoM || null);
  }, [meeting]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const res = await aiSummaryTemplateApi.getTemplates();
      const data = res?.data || res;
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load templates:", err);
      toast.error("Failed to load AI summary templates");
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const openTemplateModal = () => {
    fetchTemplates();
    setIsTemplateModalOpen(true);
  };

  const executeSummarize = async (templateId = null) => {
    if (!meeting) return;

    try {
      setIsSummarizing(true);
      const payload = {
        meetingId: meeting._id,
        date: meeting.date || new Date().toISOString(),
        title: meeting.title || "Meeting",
        templateId: templateId || undefined,
      };

      const res = await meetingApi.summarizeMeeting(payload);

      if (
        res.status === 202 ||
        (res.data?.success && res.data?.message?.includes("background"))
      ) {
        toast.info("MoM generation started in the background. Please wait...");
      } else if (res.data?.success) {
        const newMoM =
          res.data.mom || res.data.momText || res.data.summary || res.data;
        setCurrentSummary(newMoM);
        toast.success("Structured MoM generated successfully!");
        if (onSummaryUpdated) {
          onSummaryUpdated(newMoM);
        }
      } else {
        toast.error(res.data?.message || "Failed to generate summary");
      }
    } catch (err) {
      console.error("Summarization error:", err);
      toast.error(
        err.response?.data?.message || err.message || "AI summarization failed",
      );
    } finally {
      setIsSummarizing(false);
    }
  };

  const requestConfirmation = (title, message, action) => {
    if (currentSummary && Object.keys(currentSummary).length > 0) {
      setConfirmModalConfig({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
          action();
        },
      });
    } else {
      action();
    }
  };

  const handleRegenerateClick = () => {
    requestConfirmation(
      "Confirm Regenerate Summary",
      "Regenerating will overwrite existing MoM sections. Are you sure you want to proceed?",
      () => executeSummarize(null),
    );
  };

  const handleApplyTemplateSelect = (template) => {
    setIsTemplateModalOpen(false);
    setSelectedTemplate(template);

    requestConfirmation(
      `Apply Template: ${template.name}`,
      `Applying "${template.name}" will overwrite the current MoM summary sections with the selected template structure. Continue?`,
      () => executeSummarize(template._id),
    );
  };

  const handleRestoredVersion = (updatedMeeting) => {
    if (updatedMeeting) {
      const restored = updatedMeeting.summary || updatedMeeting.structuredMoM;
      setCurrentSummary(restored);
      if (onSummaryUpdated) {
        onSummaryUpdated(restored);
      }
    }
  };

  if (!meeting) return null;

  const renderStructuredSummary = (structured) => {
    if (!structured) return null;

    return (
      <div className="space-y-4">
        {structured.summary && (
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
        )}

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
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
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

  const summaryText =
    typeof currentSummary === "string" ? currentSummary : null;
  const shouldShowExpandButton = summaryText && summaryText.length > 500;

  const truncateAtWord = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    const lastSpace = text.lastIndexOf(" ", maxLength);
    return text.substring(0, lastSpace > 0 ? lastSpace : maxLength) + "...";
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-600 dark:text-blue-400"
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
            AI Summary & Structured MoM
          </h2>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRegenerateClick}
              disabled={isSummarizing}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Regenerate AI summary with default rules"
              data-testid="regenerate-summary-btn"
            >
              <svg
                className={`w-3.5 h-3.5 ${isSummarizing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isSummarizing ? "Generating..." : "Regenerate Summary"}
            </button>

            <button
              onClick={openTemplateModal}
              disabled={isSummarizing}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Apply AI Summary Template"
              data-testid="apply-template-btn"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              Apply Template
            </button>

            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="View version history & restore previous versions"
              data-testid="restore-previous-btn"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Restore Previous
            </button>

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Print formatted Minutes of Meeting (MoM)"
              data-testid="print-mom-btn"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              Print Minutes
            </button>
          </div>
        </div>

        {/* Content Render */}
        {!currentSummary ? (
          <div className="text-gray-500 dark:text-gray-400 text-sm py-8 text-center bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-750">
            <p>No summary available yet.</p>
            <p className="text-xs mt-1">
              Click <strong>Regenerate Summary</strong> or{" "}
              <strong>Apply Template</strong> to create AI insights.
            </p>
          </div>
        ) : (
          <div className="text-gray-700 dark:text-gray-300 text-sm">
            {typeof currentSummary === "object" ? (
              renderStructuredSummary(currentSummary)
            ) : (
              <div className="whitespace-pre-wrap">
                {shouldShowExpandButton && !isExpanded ? (
                  <>
                    <GlossaryHighlighter
                      text={truncateAtWord(summaryText, 500)}
                    />
                    <button
                      onClick={() => setIsExpanded(true)}
                      className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
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
                        className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                      >
                        Show less
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <MeetingStats meeting={meeting} />

      {/* AI Summary Template Picker Modal */}
      {isTemplateModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Select AI Summary Template"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Select AI Summary Template
              </h3>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Choose a custom structured template to format and highlight
              specific sections of your meeting minutes.
            </p>

            {loadingTemplates ? (
              <div className="py-8 text-center text-sm text-gray-500">
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No templates configured for this organization.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {templates.map((tpl) => (
                  <div
                    key={tpl._id}
                    onClick={() => handleApplyTemplateSelect(tpl)}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/30 cursor-pointer transition-colors flex justify-between items-start"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white">
                          {tpl.name}
                        </span>
                        {tpl.isDefault && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {tpl.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 bg-purple-600 text-white text-xs font-semibold rounded hover:bg-purple-700"
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Overwrite Modal */}
      {confirmModalConfig.isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex justify-center items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Action"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {confirmModalConfig.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              {confirmModalConfig.message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))
                }
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModalConfig.onConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium cursor-pointer"
                data-testid="confirm-overwrite-btn"
              >
                Confirm Overwrite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {isHistoryModalOpen && (
        <NoteVersionHistory
          meetingId={meeting._id}
          field="summary"
          onClose={() => setIsHistoryModalOpen(false)}
          onRestored={handleRestoredVersion}
        />
      )}

      {/* Print Minutes Modal */}
      <PrintMomModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        meeting={meeting}
        summary={currentSummary}
      />
    </>
  );
};

export default MeetingSummary;
