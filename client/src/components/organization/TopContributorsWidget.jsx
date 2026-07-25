import React, { useEffect, useState } from "react";
import { organizationApi } from "../../services";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";

const TopContributorsWidget = ({ organizationId }) => {
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const { data } = await organizationApi.getLeaderboard(organizationId);
        if (data.success) {
          setContributors(data.topContributors || []);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700 shadow-sm p-6">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading Leaderboard...
        </p>
      </div>
    );
  }

  if (contributors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700 shadow-sm p-6 text-center">
        <div className="bg-slate-100 dark:bg-gray-700 p-3 rounded-full mb-3">
          <Trophy className="h-6 w-6 text-slate-400 dark:text-gray-500" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">
          No contributors yet
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
          Complete action items and summaries to earn points!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200/80 dark:border-gray-700 shadow-sm p-5 sm:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg">
            <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 tracking-tight">
            Top Contributors
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4">
        {contributors.map((contributor, index) => (
          <div
            key={contributor._id || index}
            className="flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-gray-700">
                {contributor.profilePic ? (
                  <img
                    src={contributor.profilePic}
                    alt={contributor.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-600 dark:text-gray-300">
                    {contributor.name
                      ? contributor.name.charAt(0).toUpperCase()
                      : "?"}
                  </span>
                )}
                {index === 0 && (
                  <div className="absolute -top-1 -right-1 bg-amber-400 text-white rounded-full p-0.5 shadow-sm ring-2 ring-white dark:ring-gray-800">
                    <Trophy className="w-3 h-3" />
                  </div>
                )}
                {index === 1 && (
                  <div className="absolute -top-1 -right-1 bg-slate-300 text-slate-700 rounded-full p-0.5 shadow-sm ring-2 ring-white dark:ring-gray-800">
                    <Medal className="w-3 h-3" />
                  </div>
                )}
                {index === 2 && (
                  <div className="absolute -top-1 -right-1 bg-amber-600 text-white rounded-full p-0.5 shadow-sm ring-2 ring-white dark:ring-gray-800">
                    <Award className="w-3 h-3" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate pr-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {contributor.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400 truncate">
                  {contributor.role || "Member"}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end shrink-0">
              <span className="text-sm font-bold text-slate-700 dark:text-gray-200">
                {contributor.engagementScore || 0}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-gray-500">
                Pts
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopContributorsWidget;
