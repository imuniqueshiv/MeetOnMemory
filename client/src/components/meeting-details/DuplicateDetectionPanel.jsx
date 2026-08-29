import React, { useMemo, useState } from "react";
import { useMeetingDuplicates } from "../../hooks/useMeetingDuplicates";
import { format } from "date-fns";
import { RotateCcw, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

const FIELD_DEFINITIONS = [
  { key: "title", label: "Title" },
  { key: "time", label: "Date & time" },
  { key: "participants", label: "Participants" },
  { key: "summary", label: "Summary" },
  { key: "tags", label: "Tags" },
];

const getFieldValue = (meeting, field) => {
  if (!meeting) return "—";

  switch (field) {
    case "title":
      return meeting.title || "—";
    case "time":
      if (!meeting.date && !meeting.time) return "Unknown";
      return [
        meeting.date ? format(new Date(meeting.date), "PPP p") : "Unknown date",
        meeting.time || null,
      ]
        .filter(Boolean)
        .join(" • ");
    case "participants":
      return meeting.participants?.length
        ? meeting.participants
            .map((participant) => participant.name || participant.email)
            .filter(Boolean)
            .join(", ")
        : "None";
    case "summary":
      return meeting.summary || "No summary";
    case "tags":
      return meeting.tags?.length ? meeting.tags.join(", ") : "No tags";
    default:
      return "—";
  }
};

const DuplicateDetectionPanel = ({
  meetingId,
  meeting,
  onMergeSuccess,
  initialMergeAuditId,
}) => {
  const {
    duplicates,
    isLoading,
    isError,
    mergeMeetings,
    isMerging,
    dismissDuplicate,
    isDismissing,
    rollbackMerge,
    isRollingBack,
    lastMergeAudit,
    setLastMergeAudit,
  } = useMeetingDuplicates(meetingId);

  const [selectedSecondary, setSelectedSecondary] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [fieldSelections, setFieldSelections] = useState({});

  const activeAudit =
    lastMergeAudit ||
    (initialMergeAuditId ? { mergeAuditId: initialMergeAuditId } : null);

  const diffFields = useMemo(
    () =>
      selectedSecondary
        ? FIELD_DEFINITIONS.map((field) => ({
            ...field,
            primaryValue: getFieldValue(
              meeting || { title: "Current meeting" },
              field.key,
            ),
            secondaryValue: getFieldValue(selectedSecondary, field.key),
          }))
        : [],
    [selectedSecondary, meeting],
  );

  const handleMergeClick = (duplicate) => {
    setSelectedSecondary(duplicate);
    setFieldSelections(
      FIELD_DEFINITIONS.reduce(
        (acc, field) => ({ ...acc, [field.key]: "primary" }),
        {},
      ),
    );
    setShowConfirm(true);
  };

  const confirmMerge = async () => {
    if (!selectedSecondary) return;

    try {
      await mergeMeetings({
        primaryId: meetingId,
        secondaryId: selectedSecondary._id,
        fieldSelections,
      });

      setShowConfirm(false);
      setSelectedSecondary(null);
      if (onMergeSuccess) {
        await onMergeSuccess();
      } else {
        window.dispatchEvent(
          new CustomEvent("meetingMerged", {
            detail: {
              primaryId: meetingId,
              secondaryId: selectedSecondary._id,
            },
          }),
        );
      }
    } catch {
      // Error handled by hook.
    }
  };

  const handleDismiss = async (secondaryId) => {
    try {
      await dismissDuplicate({
        primaryId: meetingId,
        secondaryId,
      });
    } catch {
      // Error handled by hook.
    }
  };

  const confirmRollback = async () => {
    if (!activeAudit?.mergeAuditId) return;

    try {
      await rollbackMerge({
        primaryId: meetingId,
        mergeAuditId: activeAudit.mergeAuditId,
      });
      setShowRollbackConfirm(false);
      if (onMergeSuccess) {
        await onMergeSuccess();
      } else {
        window.dispatchEvent(
          new CustomEvent("meetingMergeRolledBack", {
            detail: {
              primaryId: meetingId,
              mergeAuditId: activeAudit.mergeAuditId,
            },
          }),
        );
      }
    } catch {
      // Error handled by hook.
    }
  };

  // If no duplicates and no active rollback, don't render
  if (
    (isLoading || isError || !duplicates || duplicates.length === 0) &&
    !activeAudit
  ) {
    return null;
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Rollback Prompt Banner */}
      {activeAudit && (
        <div
          data-testid="rollback-banner"
          className="bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-500 p-4 rounded-r-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
                Meeting Merged Recently
              </p>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                You can undo the duplicate merge and restore the original field
                values.
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="trigger-rollback-btn"
            onClick={() => setShowRollbackConfirm(true)}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Undo / Rollback Merge
          </button>
        </div>
      )}

      {/* Duplicate Candidates Card */}
      {duplicates && duplicates.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 p-4 rounded-r-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Potential duplicate meetings detected ({duplicates.length})
              </h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                <p>
                  We found other meetings with similar titles, dates, or
                  participants. Review them below to avoid duplicates.
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {duplicates.map((dup) => (
                  <div
                    key={dup._id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-md border border-yellow-200 dark:border-yellow-900/50 shadow-2xs"
                  >
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                        {dup.title}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {dup.date
                          ? format(new Date(dup.date), "PPP p")
                          : "No date"}
                        {dup.similarity && (
                          <span className="ml-2 font-medium text-yellow-600 dark:text-yellow-400">
                            ({Math.round(dup.similarity * 100)}% match)
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleMergeClick(dup)}
                        disabled={isMerging}
                        className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs font-semibold shadow-2xs disabled:opacity-50 cursor-pointer"
                      >
                        Merge Data
                      </button>
                      <button
                        onClick={() => handleDismiss(dup._id)}
                        disabled={isDismissing}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium border border-gray-300 dark:border-gray-600 disabled:opacity-50 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Confirmation Modal */}
      {showConfirm && selectedSecondary && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 space-y-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Review merge before confirming
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Select which field values to keep from each meeting. The primary
              meeting record will be updated.
            </p>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {diffFields.map((field) => (
                <div
                  key={field.key}
                  className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2"
                >
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    {field.label}
                  </span>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name={`field-${field.key}`}
                        value="primary"
                        checked={fieldSelections[field.key] === "primary"}
                        onChange={() =>
                          setFieldSelections((prev) => ({
                            ...prev,
                            [field.key]: "primary",
                          }))
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white block">
                          Keep Current
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {field.primaryValue}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name={`field-${field.key}`}
                        value="secondary"
                        checked={fieldSelections[field.key] === "secondary"}
                        onChange={() =>
                          setFieldSelections((prev) => ({
                            ...prev,
                            [field.key]: "secondary",
                          }))
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white block">
                          Take Duplicate
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {field.secondaryValue}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMerge}
                disabled={isMerging}
                className="px-4 py-2 text-xs font-bold text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg inline-flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isMerging && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {showRollbackConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            data-testid="rollback-modal"
            className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Confirm Merge Rollback
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Undo the merged state and restore pre-merge field values
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300">
              Rolling back will revert the primary meeting's fields to their
              state before the merge occurred and reactivate the secondary
              record.
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowRollbackConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-rollback-btn"
                onClick={confirmRollback}
                disabled={isRollingBack}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isRollingBack && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Confirm Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuplicateDetectionPanel;
