import React, { useMemo, useState } from "react";
import { useMeetingDuplicates } from "../../hooks/useMeetingDuplicates";
import { format } from "date-fns";

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

const getRawFieldValue = (meeting, field) => {
  if (!meeting) return null;
  if (field === "time") {
    return { date: meeting.date ?? null, time: meeting.time ?? "" };
  }
  return meeting[field] ?? null;
};

const valuesEqual = (left, right) =>
  JSON.stringify(left) === JSON.stringify(right);

const DuplicateDetectionPanel = ({ meetingId, meeting, onMergeSuccess }) => {
  const {
    duplicates,
    isLoading,
    isError,
    mergeMeetings,
    isMerging,
    dismissDuplicate,
    isDismissing,
  } = useMeetingDuplicates(meetingId);

  const [selectedSecondary, setSelectedSecondary] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldSelections, setFieldSelections] = useState({});

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

  if (isLoading || isError || !duplicates || duplicates.length === 0) {
    return null;
  }

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

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Potential Duplicate Meetings Detected
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <ul role="list" className="space-y-3">
              {duplicates.map((dup) => (
                <li
                  key={dup._id}
                  className="bg-white bg-opacity-50 p-3 rounded flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium">{dup.title}</div>
                    <div className="text-xs opacity-75">
                      {dup.date
                        ? format(new Date(dup.date), "PPP p")
                        : "Unknown Date"}{" "}
                      • Similarity:{" "}
                      {Math.round(
                        (dup.scores?.composite ?? dup.similarity ?? 0) * 100,
                      )}
                      %
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMergeClick(dup)}
                      disabled={isMerging}
                      className="px-3 py-1 bg-yellow-600 text-white rounded text-xs font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                    >
                      {isMerging ? "Merging..." : "Merge Data"}
                    </button>
                    <button
                      onClick={() => handleDismiss(dup._id)}
                      disabled={isDismissing}
                      className="px-3 py-1 bg-white text-yellow-800 border border-yellow-300 rounded text-xs font-medium hover:bg-yellow-50 disabled:opacity-50 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {showConfirm && selectedSecondary && (
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-merge-title"
        >
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3
              id="duplicate-merge-title"
              className="text-lg font-semibold text-gray-900 mb-2"
            >
              Review merge before confirming
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Choose which meeting wins for each field. Related transcript,
              comments, action items, attachments, decisions, and key moments
              are still merged into the primary meeting.
            </p>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">
                      Field
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">
                      Current meeting
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">
                      Duplicate
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">
                      Survivor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {diffFields.map((field) => {
                    const primaryRaw = getRawFieldValue(
                      meeting || { title: "Current meeting" },
                      field.key,
                    );
                    const secondaryRaw = getRawFieldValue(
                      selectedSecondary,
                      field.key,
                    );
                    const isDifferent = !valuesEqual(primaryRaw, secondaryRaw);

                    return (
                      <tr key={field.key}>
                        <td className="px-4 py-3 font-medium text-gray-900 align-top">
                          {field.label}
                        </td>
                        <td className="px-4 py-3 text-gray-600 align-top max-w-[260px] break-words">
                          {field.primaryValue}
                        </td>
                        <td className="px-4 py-3 text-gray-600 align-top max-w-[260px] break-words">
                          {field.secondaryValue}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col gap-2">
                            {["primary", "secondary"].map((winner) => (
                              <label
                                key={winner}
                                className="flex items-center gap-2 whitespace-nowrap"
                              >
                                <input
                                  type="radio"
                                  name={`merge-field-${field.key}`}
                                  value={winner}
                                  checked={
                                    fieldSelections[field.key] === winner
                                  }
                                  onChange={() =>
                                    setFieldSelections((current) => ({
                                      ...current,
                                      [field.key]: winner,
                                    }))
                                  }
                                />
                                {winner === "primary" ? "Current" : "Duplicate"}
                              </label>
                            ))}
                            {!isDifferent && (
                              <span className="text-xs text-gray-400">
                                Identical
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setSelectedSecondary(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmMerge}
                disabled={isMerging}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
              >
                {isMerging ? "Merging..." : "Confirm Merge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuplicateDetectionPanel;
