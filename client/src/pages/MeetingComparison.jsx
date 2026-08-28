import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  compareMeetings,
  getComparableMeetings,
} from "../services/comparisonApi";

const ItemDiffList = ({ title, diff, isActionItem }) => {
  const { t } = useTranslation();

  if (!diff) return null;

  const { resolved, added, carriedOver } = diff;

  const renderItem = (itemData, type) => {
    let text = "";
    if (isActionItem) {
      text =
        itemData.item.task ||
        itemData.item.action ||
        JSON.stringify(itemData.item);
      if (itemData.item.owner) text += ` (${itemData.item.owner})`;
    } else {
      text =
        typeof itemData.item === "string"
          ? itemData.item
          : JSON.stringify(itemData.item);
    }

    let icon, colorClass, badgeText, badgeClass;
    if (type === "resolved") {
      icon = (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
      );
      colorClass = "text-green-500";
      badgeText = isActionItem
        ? t("meetingComparison.resolved")
        : t("meetingComparison.dropped");
      badgeClass =
        "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
    } else if (type === "added") {
      icon = (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
          ></path>
        </svg>
      );
      colorClass = "text-blue-500";
      badgeText = t("meetingComparison.added");
      badgeClass =
        "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
    } else {
      icon = (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          ></path>
        </svg>
      );
      colorClass = "text-gray-500";
      badgeText = t("meetingComparison.carriedOver");
      badgeClass =
        "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
    }

    return (
      <li
        key={text}
        className="flex items-start py-3 border-b border-gray-100 dark:border-gray-800 last:border-0"
      >
        <div className={`mt-0.5 mr-3 shrink-0 ${colorClass}`}>{icon}</div>
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
            {text}
          </p>
          {type === "carriedOver" && (
            <p className="text-xs text-gray-500 mt-1">
              {t("meetingComparison.similarity")}:{" "}
              {(itemData.similarity * 100).toFixed(0)}%
            </p>
          )}
        </div>
        <div
          className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}
        >
          {badgeText}
        </div>
      </li>
    );
  };

  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {resolved.map((item) => renderItem(item, "resolved"))}
        {added.map((item) => renderItem(item, "added"))}
        {carriedOver.map((item) => renderItem(item, "carriedOver"))}

        {resolved.length === 0 &&
          added.length === 0 &&
          carriedOver.length === 0 && (
            <li className="py-4 text-sm text-gray-500 italic text-center">
              {t("meetingComparison.noChanges")}
            </li>
          )}
      </ul>
    </div>
  );
};

const MeetingComparison = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const meetingIdA = searchParams.get("meetingA");
  const meetingIdB = searchParams.get("meetingB");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [comparableMeetings, setComparableMeetings] = useState([]);

  useEffect(() => {
    if (!meetingIdA) return;
    const fetchComparable = async () => {
      try {
        const meetings = await getComparableMeetings(meetingIdA);
        setComparableMeetings(meetings);
      } catch (err) {
        console.error("Failed to fetch comparable meetings", err);
      }
    };
    fetchComparable();
  }, [meetingIdA]);

  useEffect(() => {
    if (!meetingIdA || !meetingIdB) {
      setError(t("meetingComparison.missingIds"));
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await compareMeetings(meetingIdA, meetingIdB);
        setComparisonData(data);
      } catch (err) {
        setError(
          err.response?.data?.message || t("meetingComparison.failedLoad"),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [meetingIdA, meetingIdB, t]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400">
          <p>{error}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            ></path>
          </svg>
          {t("meetingComparison.goBack")}
        </button>
      </div>
    );
  }

  if (!comparisonData) return null;

  const { meetingA, meetingB, actionItemsDiff, decisionsDiff, aiSummary } =
    comparisonData;

  const selectOptions = [...comparableMeetings];
  if (meetingB && !selectOptions.some((m) => m._id === meetingB._id)) {
    selectOptions.unshift(meetingB);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="mr-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            aria-label={t("meetingComparison.goBack")}
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400 RTL-mirror"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              ></path>
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg
              className="w-8 h-8 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              ></path>
            </svg>
            {t("meetingComparison.title")}
          </h1>
        </div>

        {selectOptions.length > 0 && (
          <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pl-2">
              {t("meetingComparison.compareWith")}
            </span>
            <select
              value={meetingIdB || ""}
              onChange={(e) => {
                if (e.target.value) {
                  navigate(
                    `/meetings/compare?meetingA=${meetingIdA}&meetingB=${e.target.value}`,
                  );
                }
              }}
              className="bg-transparent border-0 text-sm font-semibold text-blue-600 dark:text-blue-400 focus:ring-0 focus:outline-none cursor-pointer pr-8"
            >
              {selectOptions.map((meeting) => (
                <option
                  key={meeting._id}
                  value={meeting._id}
                  className="text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                >
                  {meeting.title} ({new Date(meeting.date).toLocaleDateString()}
                  )
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* AI Summary Card */}
      <div className="mb-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-3">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              ></path>
            </svg>
            {t("meetingComparison.aiSummary")}
          </h2>
          <p className="text-blue-900 dark:text-blue-100 text-sm whitespace-pre-wrap leading-relaxed">
            {aiSummary}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Meeting A Column */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 flex-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 mb-3">
              {t("meetingComparison.previous")}
            </span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {meetingA.title}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {new Date(meetingA.date).toLocaleDateString()}
            </p>
            <div className="h-px bg-gray-200 dark:bg-gray-700 w-full mb-4"></div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {meetingA.summary}
            </p>
          </div>
        </div>

        {/* Meeting B Column */}
        <div className="bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-500 rounded-xl shadow-sm overflow-hidden flex flex-col relative">
          <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
            {t("meetingComparison.latest")}
          </div>
          <div className="px-6 py-5 flex-1 mt-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {meetingB.title}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {new Date(meetingB.date).toLocaleDateString()}
            </p>
            <div className="h-px bg-gray-200 dark:bg-gray-700 w-full mb-4"></div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {meetingB.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Diff Lists */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5">
          <ItemDiffList
            title={t("meetingComparison.actionItemsEvolution")}
            diff={actionItemsDiff}
            isActionItem={true}
          />
          <div className="h-px bg-gray-200 dark:bg-gray-700 w-full my-6"></div>
          <ItemDiffList
            title={t("meetingComparison.decisionsEvolution")}
            diff={decisionsDiff}
            isActionItem={false}
          />
        </div>
      </div>
    </div>
  );
};

export default MeetingComparison;
