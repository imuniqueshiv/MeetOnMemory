// client/src/pages/KnowledgeTimeline.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import { knowledgeApi } from "../services";
import { toast } from "react-toastify";
import {
  MessageSquare,
  Loader2,
  RefreshCw,
  AlertTriangle,
  FileText,
  ArrowRight,
  GitBranch,
  Calendar,
  ExternalLink,
} from "lucide-react";
import StatusBadge from "../components/Knowledge/StatusBadge.jsx";
import TimelineSkeleton from "../components/Knowledge/TimelineSkeleton.jsx";
import { askAssistantAbout } from "../utils/askAssistant.js";

const KnowledgeTimeline = () => {
  const { decisionId } = useParams();
  const navigate = useNavigate();

  const [lineage, setLineage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetches the decision lineage data from the API.
   * Includes robust error handling and state management.
   */
  const fetchLineage = useCallback(async () => {
    if (!decisionId) {
      setError("Invalid decision ID provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await knowledgeApi.getDecisionLineage(decisionId);

      if (res.data?.success) {
        setLineage(res.data.lineage || []);
      } else {
        throw new Error(
          res.data?.message || "Failed to load decision lineage.",
        );
      }
    } catch (err) {
      console.error("Failed to load decision lineage:", err);
      setError(
        err.message ||
          "An unexpected error occurred while loading the timeline.",
      );
      toast.error("Failed to load knowledge timeline.");
    } finally {
      setLoading(false);
    }
  }, [decisionId]);

  useEffect(() => {
    fetchLineage();
  }, [fetchLineage]);

  const latest = lineage[0];
  const pinTitle = latest?.text
    ? latest.text.slice(0, 80) + (latest.text.length > 80 ? "..." : "")
    : "Knowledge decision";

  // Group lineage items by date for better visual hierarchy and UX
  const groupedLineage = lineage.reduce((acc, item) => {
    const date = new Date(item.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
            <Link
              to="/knowledge"
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Knowledge Base
            </Link>
            <ArrowRight className="w-4 h-4" />
            <span className="text-slate-900 dark:text-white font-medium">
              Decision Timeline
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <GitBranch className="w-8 h-8 text-violet-600 dark:text-violet-400" />
                Decision Timeline
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400 max-w-2xl">
                Track the evolution, context, and related actions of this
                organizational decision.
              </p>
            </div>

            {decisionId && !loading && !error && (
              <button
                onClick={() =>
                  askAssistantAbout(navigate, {
                    type: "knowledge",
                    refId: decisionId,
                    title: pinTitle,
                  })
                }
                className="inline-flex items-center gap-2 self-start md:self-auto px-4 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm font-semibold hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors shadow-sm cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                Ask Assistant about this
              </button>
            )}
          </div>
        </div>

        {/* Error State with Retry */}
        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-red-900 dark:text-red-200 mb-2">
              Failed to Load Timeline
            </h3>
            <p className="text-red-700 dark:text-red-300 mb-6 max-w-md mx-auto">
              {error}
            </p>
            <button
              onClick={fetchLineage}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Loading
            </button>
          </div>
        )}

        {/* Loading State (Skeleton) */}
        {loading && <TimelineSkeleton />}

        {/* Empty State */}
        {!loading && !error && lineage.length === 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              No History Found
            </h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
              This decision does not have any recorded lineage or historical
              context yet. Related actions or updates will appear here as they
              are created.
            </p>
            <Link
              to="/knowledge"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Browse All Knowledge
            </Link>
          </div>
        )}

        {/* Timeline Content */}
        {!loading && !error && lineage.length > 0 && (
          <div className="relative">
            {/* Vertical connecting line */}
            <div className="absolute left-4 md:left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-800"></div>

            <div className="space-y-8">
              {Object.entries(groupedLineage).map(([date, items]) => (
                <div key={date} className="space-y-6">
                  {/* Date Group Header */}
                  <div className="relative pl-8 md:pl-12">
                    <div className="absolute -left-[5px] md:-left-[3px] top-1.5 w-3 h-3 rounded-full bg-slate-400 dark:bg-slate-600 ring-4 ring-slate-50 dark:ring-slate-950"></div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-md">
                      {date}
                    </span>
                  </div>

                  {/* Items for this date */}
                  <div className="space-y-4">
                    {items.map((d, index) => (
                      <div
                        key={d._id || index}
                        className="relative pl-8 md:pl-12 group"
                      >
                        {/* Timeline Node */}
                        <div className="absolute left-4 md:left-6 top-6 w-4 h-4 rounded-full bg-violet-600 dark:bg-violet-500 ring-4 ring-slate-50 dark:ring-slate-950 group-hover:scale-110 transition-transform"></div>

                        {/* Event Card */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:border-violet-200 dark:hover:border-violet-800 transition-all duration-200">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <StatusBadge status={d.status} />
                              {d.sourceMeetingId?.title && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {d.sourceMeetingId.title}
                                </span>
                              )}
                            </div>

                            {/* Quick Links to Related Records */}
                            {d.relatedActionItems &&
                              d.relatedActionItems.length > 0 && (
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  <span>
                                    {d.relatedActionItems.length} related
                                    action(s)
                                  </span>
                                  <ExternalLink className="w-3 h-3" />
                                </div>
                              )}
                          </div>

                          <p className="text-slate-900 dark:text-slate-100 font-medium leading-relaxed mb-4">
                            {d.text}
                          </p>

                          {/* Metadata Footer */}
                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span>
                                {new Date(d.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {d.author?.name && (
                                <>
                                  <span>•</span>
                                  <span>By {d.author.name}</span>
                                </>
                              )}
                            </div>

                            {d.relatedDecisionId && (
                              <Link
                                to={`/knowledge/timeline/${d.relatedDecisionId}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                              >
                                View Parent Decision
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default KnowledgeTimeline;
