import React, { useState } from "react";
import { useMeetingContributions } from "../../hooks/useParticipantContributions";

const DIMENSIONS = ["verbal", "decisional", "task", "collaborative"];

const ContributionSummaryPanel = ({ meetingId }) => {
  const { data, isLoading, isError } = useMeetingContributions(meetingId);
  const [showDetail, setShowDetail] = useState(false);

  if (isLoading)
    return (
      <div className="animate-pulse bg-gray-200 h-24 rounded-lg w-full"></div>
    );
  if (isError)
    return (
      <div className="text-red-500 text-sm">
        Failed to load contribution summary.
      </div>
    );

  const contributions = data?.contributions || [];
  const equityScore = data?.equityScore || 0;
  const equity = data?.equity;

  if (contributions.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border text-sm text-gray-500 text-center">
        Contribution data is not yet calculated for this meeting.
      </div>
    );
  }

  // Get top 3 contributors
  const topContributors = [...contributions]
    .sort((a, b) => b.overallImpact - a.overallImpact)
    .slice(0, 3);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <h3 className="font-medium text-gray-900 mb-3 flex items-center justify-between">
        Contribution Summary
        <span
          className={`text-xs px-2 py-1 rounded-full ${equityScore > 70 ? "bg-green-100 text-green-800" : equityScore > 40 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}
        >
          Equity: {equityScore}
        </span>
      </h3>

      <div className="space-y-3">
        {topContributors.map((c, i) => (
          <div
            key={c.participantId}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 font-mono w-4">{i + 1}.</span>
              <span
                className="font-medium text-gray-700 truncate max-w-[120px]"
                title={c.participantName}
              >
                {c.participantName}
              </span>
            </div>
            <div className="flex items-center space-x-3 text-xs text-gray-500">
              <span title="Overall Impact Score" className="font-semibold">
                {c.overallImpact}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showDetail && equity && (
        <div className="mt-4 pt-3 border-t space-y-4">
          <div>
            <div className="text-xs font-medium text-gray-700 mb-2">
              Equity by dimension (100 = perfectly even)
            </div>
            {DIMENSIONS.map((dim) => {
              const value = equity.perDimension?.[dim] ?? 0;
              return (
                <div key={dim} className="mb-1">
                  <div className="flex justify-between text-[11px] text-gray-500 capitalize">
                    <span>{dim}</span>
                    <span>{value}</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded overflow-hidden">
                    <div
                      className="h-full bg-indigo-500"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div className="text-xs font-medium text-gray-700 mb-2">
              Contribution share
            </div>
            <ul className="space-y-1">
              {(equity.distribution || []).map((p, i) => (
                <li
                  key={p.participantId || i}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span
                    className="w-24 shrink-0 truncate text-gray-600"
                    title={p.participantName}
                  >
                    {p.participantName}
                  </span>
                  <span className="flex-1 h-1.5 bg-gray-200 rounded overflow-hidden">
                    <span
                      className="block h-full bg-emerald-500"
                      style={{ width: `${p.share}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-gray-500">
                    {p.share}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t text-center">
        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {showDetail ? "Hide Details" : "View Detailed Profile"} &rarr;
        </button>
      </div>
    </div>
  );
};

export default ContributionSummaryPanel;
