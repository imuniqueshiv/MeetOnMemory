import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import apiClient from "../services/apiClient";
import Navbar from "../components/Navbar.jsx";

import { handleShare } from "../utils/shareUtils.js";

const TIER_STYLES = {
  Bronze:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  Silver: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  Gold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
  Platinum:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200",
};

const formatCriteria = (criteria) => {
  if (!criteria || Object.keys(criteria).length === 0)
    return "Hidden criteria.";
  if (criteria.type === "points")
    return `Earn ${criteria.threshold} total points.`;
  if (criteria.type === "action_items")
    return `Complete ${criteria.count} action items on time.`;
  if (criteria.type === "meetings_on_time")
    return `End ${criteria.count} meetings on time.`;
  return "Unlock requirement pending.";
};

const BadgeCard = ({ badge }) => {
  const tierClass = TIER_STYLES[badge.tier] || TIER_STYLES.Bronze;
  const percent = badge.progress?.percent ?? (badge.earned ? 100 : 0);
  const showProgress = !badge.earned && badge.progress?.target != null;
  const [shareFeedback, setShareFeedback] = useState("");

  const onShareClick = async () => {
    const success = await handleShare(badge);
    if (success && !navigator.share) {
      setShareFeedback("Copied to clipboard!");
      setTimeout(() => setShareFeedback(""), 3000);
    }
  };

  return (
    <article
      id={`badge-${badge.id}`}
      className={`rounded-lg border p-5 transition flex flex-col justify-between ${
        badge.earned
          ? "border-yellow-200 bg-white dark:border-yellow-800/50 dark:bg-gray-800 shadow-sm"
          : "border-gray-200 bg-gray-50 opacity-90 dark:border-gray-700 dark:bg-gray-800/60"
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center">
              {badge.iconUrl ? (
                <img
                  src={badge.iconUrl}
                  alt=""
                  className="mr-2 inline h-5 w-5 align-text-bottom"
                />
              ) : (
                <span className="mr-2 text-xl" aria-hidden="true">
                  {badge.earned ? "🏅" : "🔒"}
                </span>
              )}
              {badge.name}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {badge.description}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${tierClass}`}
          >
            {badge.tier}
          </span>
        </div>

        {!badge.earned && (
          <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md border border-blue-100 dark:border-blue-800/30">
            <p className="text-xs font-medium text-blue-800 dark:text-blue-300 flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              Unlock Rule:{" "}
              <span className="font-normal">
                {formatCriteria(badge.criteria)}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50">
        {badge.earned ? (
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-green-700 dark:text-green-400">
              🎉 Earned
              {badge.unlockedAt
                ? ` on ${new Date(badge.unlockedAt).toLocaleDateString()}`
                : ""}
            </p>
            <div className="flex items-center gap-2">
              {shareFeedback && (
                <span className="text-[10px] text-green-600 dark:text-green-400">
                  {shareFeedback}
                </span>
              )}
              <button
                onClick={onShareClick}
                className="text-xs font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-400 py-1 px-3 rounded flex items-center transition-colors"
                title="Share this achievement"
                aria-label={`Share ${badge.name} badge`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                Share
              </button>
            </div>
          </div>
        ) : showProgress ? (
          <div>
            <div className="mb-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Progress</span>
              <span>
                {badge.progress.current} / {badge.progress.target} pts
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progress toward ${badge.name}`}
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">Locked</p>
        )}
      </div>
    </article>
  );
};

const Badges = () => {
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const response = await apiClient.get("/api/gamification/badges");
        if (response.data.success) {
          setData(response.data.data);
        }
      } catch (error) {
        console.error("Failed to load badges", error);
        toast.error("Failed to load badges gallery.");
      } finally {
        setLoading(false);
      }
    };
    fetchBadges();
  }, []);

  useEffect(() => {
    if (!data || !location.hash) return;
    const el = document.querySelector(location.hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [data, location.hash]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 transition-colors dark:bg-gray-900 dark:text-gray-100">
      <Navbar />
      <div className="mx-auto w-full max-w-4xl px-4 pb-20 pt-24 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Badges gallery
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Browse earned and locked badges, and track progress toward the
              next unlock.
            </p>
          </div>
          <Link
            to="/leaderboard"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            View leaderboard
          </Link>
        </div>

        {loading ? (
          <p className="text-center text-lg font-medium">Loading badges...</p>
        ) : !data ? (
          <div className="rounded-lg border border-gray-100 bg-white p-6 text-center shadow-md dark:border-gray-700 dark:bg-gray-800">
            No badge data available.
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-wrap gap-3 text-sm">
              <span className="rounded-lg bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {data.totalPoints} pts
              </span>
              <span className="rounded-lg bg-white px-3 py-1.5 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
                {data.summary.earnedCount} earned
              </span>
              <span className="rounded-lg bg-white px-3 py-1.5 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
                {data.summary.lockedCount} locked
              </span>
            </div>

            {data.inProgress?.length > 0 && (
              <section className="mb-10">
                <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
                  In progress
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.inProgress.map((badge) => (
                    <BadgeCard key={badge.id} badge={badge} />
                  ))}
                </div>
              </section>
            )}

            <section className="mb-10">
              <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
                Earned
              </h2>
              {data.earned.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No badges earned yet. Keep improving meeting hygiene.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.earned.map((badge) => (
                    <BadgeCard key={badge.id} badge={badge} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
                Locked
              </h2>
              {data.locked.filter(
                (b) => !(b.progress?.target != null && b.progress.percent > 0),
              ).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {data.locked.length === 0
                    ? "You have unlocked every badge."
                    : "All remaining badges are in progress above."}
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.locked
                    .filter(
                      (b) =>
                        !(b.progress?.target != null && b.progress.percent > 0),
                    )
                    .map((badge) => (
                      <BadgeCard key={badge.id} badge={badge} />
                    ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default Badges;
