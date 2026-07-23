import React, { useState, useEffect } from "react";
import { Trophy, Medal, Award, TrendingUp, Clock } from "lucide-react";
import { organizationApi } from "../../services";
import AppContent from "../../context/AppContent";

const Leaderboard = ({ organizationId }) => {
  const { userData } = React.useContext(AppContent);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!organizationId) return;

      try {
        setLoading(true);
        setError(null);
        const { data } = await organizationApi.getLeaderboard(organizationId);

        if (data.success) {
          setLeaderboard(data.leaderboard);
        } else {
          setError(data.message || "Failed to load leaderboard");
        }
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
        setError("Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [organizationId]);

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return (
          <span className="w-5 h-5 flex items-center justify-center text-sm font-semibold text-gray-500">
            {rank}
          </span>
        );
    }
  };

  const getRankBg = (rank) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800";
      case 2:
        return "bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 border-gray-200 dark:border-gray-700";
      case 3:
        return "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800";
      default:
        return "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700";
    }
  };

  const formatLastActivity = (date) => {
    if (!date) return "No activity";
    const now = new Date();
    const activityDate = new Date(date);
    const diffMs = now - activityDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return activityDate.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Top Contributors
          </h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-gray-700"
            >
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/4" />
              </div>
              <div className="h-6 w-12 bg-gray-200 dark:bg-gray-600 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Top Contributors
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          {error}
        </p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Top Contributors
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No contributions yet. Start engaging to earn points!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Top Contributors
          </h3>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <TrendingUp className="w-3 h-3" />
          <span>Live</span>
        </div>
      </div>

      <div className="space-y-2">
        {leaderboard.map((entry) => {
          const isCurrentUser = entry.user?._id === userData?.id;
          return (
            <div
              key={entry.user?._id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${getRankBg(
                entry.rank,
              )} ${isCurrentUser ? "ring-2 ring-blue-500 dark:ring-blue-400" : ""}`}
            >
              <div className="flex-shrink-0">{getRankIcon(entry.rank)}</div>

              <div className="flex-shrink-0">
                {entry.user?.profilePic ? (
                  <img
                    src={entry.user.profilePic}
                    alt={entry.user.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    {entry.user?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {entry.user?.name || "Unknown User"}
                  </p>
                  {isCurrentUser && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                      You
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{formatLastActivity(entry.lastActivityAt)}</span>
                </div>
              </div>

              <div className="flex-shrink-0">
                <span className="px-3 py-1 text-sm font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full">
                  {entry.engagementScore}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Leaderboard;
