import React, { useState, useCallback, useMemo, useContext } from "react";
import {
  useTopicDashboard,
  useOrphanedTopics,
  useCoOccurrenceGraph,
  useGenerateBriefing,
  usePinTopic,
  useHideTopic,
  useMergeTopics,
} from "../hooks/useTopicIntelligence";
import AppContent from "../context/AppContent";
import { exportTopicIntelligence } from "../api/topicIntelligenceApi";
import ForceGraph2D from "react-force-graph-2d";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  BookOpen,
  Loader2,
  Pin,
  Star,
  Eye,
  EyeOff,
  GitMerge,
  Download,
} from "lucide-react";
import { toast } from "react-toastify";

const TrendIcon = ({ trend }) => {
  if (trend === "rising")
    return <TrendingUp className="text-green-500 w-5 h-5" />;
  if (trend === "declining")
    return <TrendingDown className="text-red-500 w-5 h-5" />;
  return <Minus className="text-gray-400 w-5 h-5" />;
};

export default function TopicIntelligence() {
  const { userData } = useContext(AppContent) || {};
  const isCurator = userData?.role === "owner" || userData?.role === "admin";

  const [includeHidden, setIncludeHidden] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [briefing, setBriefing] = useState("");

  // Modal target state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [sourceTopicId, setSourceTopicId] = useState("");
  const [targetTopicId, setTargetTopicId] = useState("");

  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    refetch: refetchDashboard,
  } = useTopicDashboard(includeHidden);
  const {
    data: orphanedData,
    isLoading: orphanedLoading,
    refetch: refetchOrphaned,
  } = useOrphanedTopics();
  const {
    data: graphData,
    isLoading: graphLoading,
    refetch: refetchGraph,
  } = useCoOccurrenceGraph(includeHidden);
  const { mutate: generateBriefing, isPending: briefingLoading } =
    useGenerateBriefing();

  const { mutate: pinTopicMutate } = usePinTopic();
  const { mutate: hideTopicMutate } = useHideTopic();
  const { mutate: mergeTopicsMutate } = useMergeTopics();

  const handleNodeClick = useCallback((node) => {
    setSelectedTopicId(node.id);
    setBriefing(""); // Reset briefing
  }, []);

  const handleGenerateBriefing = (clusterId) => {
    generateBriefing(clusterId, {
      onSuccess: (data) => {
        setBriefing(data.briefing);
      },
    });
  };

  const handlePinToggle = (clusterId, currentPinned) => {
    pinTopicMutate(
      { clusterId, isPinned: !currentPinned },
      {
        onSuccess: () => {
          toast.success(
            `Topic ${!currentPinned ? "pinned" : "unpinned"} successfully`,
          );
          refetchDashboard();
          refetchGraph();
        },
        onError: (err) => {
          toast.error(
            err.response?.data?.message || "Failed to update pin status",
          );
        },
      },
    );
  };

  const handleHideToggle = (clusterId, currentHidden) => {
    hideTopicMutate(
      { clusterId, isHidden: !currentHidden },
      {
        onSuccess: () => {
          toast.success(
            `Topic ${!currentHidden ? "hidden" : "unhidden"} successfully`,
          );
          refetchDashboard();
          refetchGraph();
        },
        onError: (err) => {
          toast.error(
            err.response?.data?.message || "Failed to update hidden status",
          );
        },
      },
    );
  };

  const handleMerge = () => {
    if (!sourceTopicId || !targetTopicId) {
      toast.error("Please select both source and target topics");
      return;
    }
    if (sourceTopicId === targetTopicId) {
      toast.error("Source and Target topics cannot be the same");
      return;
    }
    mergeTopicsMutate(
      { sourceClusterId: sourceTopicId, targetClusterId: targetTopicId },
      {
        onSuccess: () => {
          toast.success("Topics merged successfully");
          setShowMergeModal(false);
          setSourceTopicId("");
          setTargetTopicId("");
          refetchDashboard();
          refetchGraph();
          refetchOrphaned();
          setSelectedTopicId(null);
        },
        onError: (err) => {
          toast.error(err.response?.data?.message || "Failed to merge topics");
        },
      },
    );
  };

  const handleExport = async (format) => {
    try {
      const blob = await exportTopicIntelligence(format);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `topic_intelligence.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success(`Topic intelligence exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("Failed to export topic intelligence");
    }
  };

  const formattedHeatmapData = useMemo(() => {
    if (!dashboardData?.trends) return [];

    const weeksSet = new Set();
    dashboardData.trends.forEach((t) => {
      t.history.forEach((h) => weeksSet.add(h.weekStarting));
    });

    const weeks = Array.from(weeksSet).sort();

    return weeks.map((week) => {
      const weekObj = {
        name: new Date(week).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      };
      dashboardData.trends.forEach((t) => {
        const hist = t.history.find((h) => h.weekStarting === week);
        weekObj[t.label] = hist ? hist.occurrences : 0;
      });
      return weekObj;
    });
  }, [dashboardData]);

  if (dashboardLoading || orphanedLoading || graphLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Topic Intelligence</h1>
        <p className="text-gray-500 mt-2">
          Analyze macro trends, co-occurrences, and knowledge gaps across all
          meetings.
        </p>
      </header>

      {/* Curator Control Panel */}
      {isCurator && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-150 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
              Curator Control
            </span>
            <label className="flex items-center space-x-2 text-sm text-gray-600 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={includeHidden}
                onChange={(e) => setIncludeHidden(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
              />
              <span>Show Hidden Topics</span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMergeModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer shadow-sm border-0"
            >
              <GitMerge size={16} />
              Merge Topics
            </button>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50 shadow-sm">
              <span className="text-xs text-gray-500 font-bold px-3 py-2 border-r border-gray-200">
                Export
              </span>
              <button
                onClick={() => handleExport("json")}
                className="flex items-center gap-1 px-3 py-2 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition cursor-pointer border-0"
              >
                <Download size={14} />
                JSON
              </button>
              <button
                onClick={() => handleExport("csv")}
                className="flex items-center gap-1 px-3 py-2 hover:bg-gray-100 text-gray-700 text-xs font-semibold border-l border-gray-200 transition cursor-pointer border-0"
              >
                <Download size={14} />
                CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {orphanedData?.orphanedTopics?.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle
                className="h-5 w-5 text-yellow-400"
                aria-hidden="true"
              />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Orphaned Topics Detected
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  These topics were discussed over 30 days ago but have no
                  associated Action Items or Decisions:
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {orphanedData.orphanedTopics.map((t) => (
                    <li key={t.clusterId}>
                      <strong>{t.label}</strong> (Last seen:{" "}
                      {new Date(t.weekStarting).toLocaleDateString()})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Heatmap / Trends Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Topic Volume Over Time
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedHeatmapData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip />
                {dashboardData?.trends?.map((trend, i) => (
                  <Line
                    key={trend.clusterId}
                    type="monotone"
                    dataKey={trend.label}
                    stroke={`hsl(${(i * 137.5) % 360}, 70%, 50%)`}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Current Trends Summary */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Current Trends
          </h2>
          <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {dashboardData?.trends?.map((trend) => (
              <div
                key={trend.clusterId}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border border-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <TrendIcon trend={trend.currentTrend} />
                  <span
                    className={`font-medium ${trend.isHidden ? "text-gray-400 line-through" : "text-gray-700"}`}
                  >
                    {trend.label}
                  </span>
                  {trend.isPinned && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Star size={10} fill="currentColor" /> Pinned
                    </span>
                  )}
                  {trend.isHidden && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded-full">
                      Hidden
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {trend.isOrphaned && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full mr-2">
                      Orphaned
                    </span>
                  )}
                  {isCurator && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          handlePinToggle(trend.clusterId, trend.isPinned)
                        }
                        className={`p-1.5 rounded hover:bg-gray-100 transition cursor-pointer border-0 ${trend.isPinned ? "text-amber-500" : "text-gray-400 hover:text-gray-600"}`}
                        title={trend.isPinned ? "Unpin Topic" : "Pin Topic"}
                      >
                        <Star
                          size={16}
                          fill={trend.isPinned ? "currentColor" : "none"}
                        />
                      </button>
                      <button
                        onClick={() =>
                          handleHideToggle(trend.clusterId, trend.isHidden)
                        }
                        className={`p-1.5 rounded hover:bg-gray-100 transition cursor-pointer border-0 ${trend.isHidden ? "text-red-500" : "text-gray-400 hover:text-gray-600"}`}
                        title={trend.isHidden ? "Unhide Topic" : "Hide Topic"}
                      >
                        {trend.isHidden ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Network Graph */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Co-Occurrence Network
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Topics connected by lines appear together in the same meetings.
          Thicker lines indicate stronger relationships. Click a node to
          analyze.
        </p>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 h-[500px]">
            {graphData && (
              <ForceGraph2D
                graphData={graphData}
                nodeLabel="label"
                nodeColor={(node) =>
                  node.isPinned
                    ? "#f59e0b"
                    : node.isHidden
                      ? "#cbd5e1"
                      : "#3b82f6"
                }
                nodeRelSize={6}
                linkColor={() => "#cbd5e1"}
                linkWidth={(link) => Math.sqrt(link.weight || 1)}
                onNodeClick={handleNodeClick}
                width={800}
                height={500}
                backgroundColor="#f8fafc"
              />
            )}
          </div>

          {/* Briefing Panel */}
          <div className="w-full lg:w-1/3 bg-gray-50 p-6 rounded-lg border border-gray-200 flex flex-col h-[500px]">
            {selectedTopicId ? (
              <>
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <BookOpen className="w-5 h-5 mr-2 text-primary" />
                  Topic Briefing
                </h3>
                <p className="text-sm text-gray-500 mt-1 mb-4">
                  {
                    graphData?.nodes?.find((n) => n.id === selectedTopicId)
                      ?.label
                  }
                </p>

                <div className="flex-1 overflow-y-auto bg-white p-4 rounded-md border border-gray-100 shadow-inner mb-4">
                  {briefingLoading ? (
                    <div className="flex justify-center items-center h-full text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      Generating briefing...
                    </div>
                  ) : briefing ? (
                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                      {briefing}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <p className="text-center">
                        Click 'Generate' to create an AI summary of all
                        discussions related to this topic.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleGenerateBriefing(selectedTopicId)}
                  disabled={briefingLoading}
                  className="w-full py-2 px-4 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium shadow-sm border-0"
                >
                  Generate AI Briefing
                </button>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-center p-4">
                Click a node in the graph to view its briefing.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Merge Topics Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Merge Topics
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Combine two topics into one. All meeting references, occurrence
              statistics, and related connections will be merged into the target
              topic, and the source topic will be deleted.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Source Topic (to be deleted)
                </label>
                <select
                  value={sourceTopicId}
                  onChange={(e) => setSourceTopicId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select source topic...</option>
                  {dashboardData?.trends?.map((t) => (
                    <option key={t.clusterId} value={t.clusterId}>
                      {t.label} {t.isHidden ? "(Hidden)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Target Topic (to keep)
                </label>
                <select
                  value={targetTopicId}
                  onChange={(e) => setTargetTopicId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select target topic...</option>
                  {dashboardData?.trends
                    ?.filter((t) => t.clusterId !== sourceTopicId)
                    ?.map((t) => (
                      <option key={t.clusterId} value={t.clusterId}>
                        {t.label} {t.isHidden ? "(Hidden)" : ""}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowMergeModal(false);
                  setSourceTopicId("");
                  setTargetTopicId("");
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition cursor-pointer border-0"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer shadow-sm border-0"
              >
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
