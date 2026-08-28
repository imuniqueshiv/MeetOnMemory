import React, { useState } from "react";
import { useDecisionImpact } from "../../hooks/useDecisionImpact.js";

const DecisionImpactPanel = ({ decisionId, isExpandedInitially = false }) => {
  const { impactData, loading, error, updateImpact } =
    useDecisionImpact(decisionId);
  const [expanded, setExpanded] = useState(isExpandedInitially);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    outcomeStatus: "pending",
    impactScore: "",
    newEvidence: "",
    nextReviewDate: "",
  });

  // Keep local state in sync when editing starts
  const handleEdit = () => {
    setFormData({
      outcomeStatus: impactData?.outcomeStatus || "pending",
      impactScore: impactData?.impactScore || "",
      newEvidence: "",
      nextReviewDate: impactData?.nextReviewDate
        ? new Date(impactData.nextReviewDate).toISOString().slice(0, 10)
        : "",
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const updates = {
        outcomeStatus: formData.outcomeStatus,
        impactScore: formData.impactScore ? Number(formData.impactScore) : null,
      };

      if (formData.nextReviewDate) {
        updates.nextReviewDate = new Date(
          formData.nextReviewDate,
        ).toISOString();
      }

      if (formData.newEvidence.trim()) {
        updates.evidence = [
          ...(impactData?.evidence || []),
          formData.newEvidence.trim(),
        ];
      }

      await updateImpact(updates);
      setIsEditing(false);
    } catch (err) {
      alert("Failed to update impact: " + err);
    }
  };

  if (loading && !impactData)
    return <div className="text-sm text-gray-500">Loading impact...</div>;
  if (error) return <div className="text-sm text-red-500">Error: {error}</div>;

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden mt-4">
      <div
        className="px-4 py-3 bg-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-800">Outcome & Impact</h3>
          {impactData?.outcomeStatus && (
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                impactData.outcomeStatus === "success"
                  ? "bg-green-100 text-green-800"
                  : impactData.outcomeStatus === "failure"
                    ? "bg-red-100 text-red-800"
                    : impactData.outcomeStatus === "mixed"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
              }`}
            >
              {impactData.outcomeStatus.toUpperCase()}
            </span>
          )}
          {impactData?.impactScore && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
              Score: {impactData.impactScore}/100
            </span>
          )}
        </div>
        <button className="text-gray-500 hover:text-gray-700">
          {expanded ? "▼" : "▶"}
        </button>
      </div>

      {expanded && (
        <div className="p-4">
          {!isEditing ? (
            <div>
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Evidence & Notes
                </h4>
                {impactData?.evidence?.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {impactData.evidence.map((ev, i) => (
                      <li key={i} className="text-sm text-gray-600">
                        {ev}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    No evidence recorded yet.
                  </p>
                )}
              </div>

              <div className="flex justify-between items-end">
                <div className="text-xs text-gray-500">
                  {impactData?.nextReviewDate
                    ? `Next review: ${new Date(impactData.nextReviewDate).toLocaleDateString()}`
                    : "No review scheduled."}
                </div>
                <button
                  onClick={handleEdit}
                  className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md font-medium transition-colors"
                >
                  {impactData ? "Update Impact" : "Log Impact"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    value={formData.outcomeStatus}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        outcomeStatus: e.target.value,
                      })
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="success">Success</option>
                    <option value="mixed">Mixed</option>
                    <option value="failure">Failure</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Impact Score (1-100)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    value={formData.impactScore}
                    onChange={(e) =>
                      setFormData({ ...formData, impactScore: e.target.value })
                    }
                    placeholder="e.g. 85"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Next Review Date
                </label>
                <input
                  type="date"
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={formData.nextReviewDate}
                  onChange={(e) =>
                    setFormData({ ...formData, nextReviewDate: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Add Evidence/Notes
                </label>
                <textarea
                  className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  rows="2"
                  value={formData.newEvidence}
                  onChange={(e) =>
                    setFormData({ ...formData, newEvidence: e.target.value })
                  }
                  placeholder="What was the result of this decision?"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DecisionImpactPanel;
