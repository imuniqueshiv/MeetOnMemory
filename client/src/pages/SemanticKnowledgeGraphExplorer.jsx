import React, { useState, useEffect, useMemo } from "react";
import {
  Network,
  Share2,
  Search,
  Layers,
  ArrowRight,
  User,
  CheckSquare,
  Lightbulb,
  Video,
  Hash,
  Sparkles,
  RefreshCw,
  Loader2,
  ExternalLink,
  Sliders,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import { semanticKnowledgeGraphApi } from "../services/semanticKnowledgeGraphApi.js";
import { meetingApi } from "../services/meetingApi.js";

const TYPE_ICONS = {
  MEETING: Video,
  DECISION: Lightbulb,
  ACTION_ITEM: CheckSquare,
  PERSON: User,
  TOPIC: Hash,
};

const TYPE_COLORS = {
  MEETING:
    "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  DECISION:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  ACTION_ITEM:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  PERSON:
    "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  TOPIC:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
};

export const SemanticKnowledgeGraphExplorer = () => {
  const [searchParams] = useSearchParams();
  const initialMeetingId = searchParams.get("meetingId") || "";

  const [meetings, setMeetings] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(initialMeetingId);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [kHops, setKHops] = useState(1);
  const [expanding, setExpanding] = useState(false);

  // Load recent meetings for picker
  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const res = await meetingApi.getMeetings({ limit: 30 });
        const list = res.data?.meetings || res.data || [];
        setMeetings(Array.isArray(list) ? list : []);
        if (!selectedMeetingId && list.length > 0) {
          setSelectedMeetingId(list[0]._id || list[0].id);
        }
      } catch (err) {
        console.error("Error loading meetings:", err);
      }
    };
    fetchMeetings();
  }, []);

  // Fetch semantic graph for selected meeting
  const fetchGraph = async () => {
    if (!selectedMeetingId) return;
    setLoading(true);
    try {
      const res =
        await semanticKnowledgeGraphApi.extractSemanticGraph(selectedMeetingId);
      if (res.data?.graph) {
        setGraphData(res.data.graph);
        setSelectedNode(null);
      }
    } catch (err) {
      console.error("Error fetching semantic graph:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMeetingId) {
      fetchGraph();
    }
  }, [selectedMeetingId]);

  // Expand neighborhood from seed node
  const handleExpandNeighborhood = async (seedNodeId) => {
    setExpanding(true);
    try {
      const res = await semanticKnowledgeGraphApi.getSemanticNeighborhood(
        seedNodeId,
        kHops,
      );
      if (res.data?.nodes) {
        setGraphData(res.data);
      }
    } catch (err) {
      console.error("Error expanding neighborhood:", err);
    } finally {
      setExpanding(false);
    }
  };

  const filteredNodes = useMemo(() => {
    return (graphData.nodes || []).filter((node) => {
      const matchesType = filterType === "ALL" || node.type === filterType;
      const matchesSearch =
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.type.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [graphData.nodes, filterType, searchQuery]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Semantic Knowledge Graph Explorer
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Entity-Relations
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Explore semantic entity relations, decisions, and k-hop
                neighborhood connections across meetings
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {meetings.length > 0 && (
              <select
                aria-label="Select meeting"
                value={selectedMeetingId}
                onChange={(e) => setSelectedMeetingId(e.target.value)}
                className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none shadow-2xs"
              >
                {meetings.map((m) => (
                  <option key={m._id || m.id} value={m._id || m.id}>
                    {m.title || "Meeting"}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={fetchGraph}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Extract Graph
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search entities or relations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Filter Type:
            </span>
            {[
              "ALL",
              "MEETING",
              "DECISION",
              "ACTION_ITEM",
              "PERSON",
              "TOPIC",
            ].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterType === type
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Grid */}
        {loading ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-16 text-center text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-indigo-500" />
            Extracting semantic graph from meeting memory...
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-16 text-center text-slate-400 space-y-2">
            <Network className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              No semantic entities found matching your filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Entities List */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Extracted Entities ({filteredNodes.length})
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredNodes.map((node) => {
                  const Icon = TYPE_ICONS[node.type] || Network;
                  const colorClass = TYPE_COLORS[node.type] || "bg-slate-100";
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <div
                      key={node.id}
                      data-testid="semantic-node-card"
                      onClick={() => setSelectedNode(node)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${colorClass}`}
                        >
                          <Icon className="w-3 h-3" />
                          {node.type}
                        </span>

                        {node.type === "MEETING" && selectedMeetingId && (
                          <Link
                            to={`/meetings/${selectedMeetingId}`}
                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            title="Open Meeting Details"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>

                      <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                        {node.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Entity Inspector & Neighborhood Expansion */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Entity Inspector
              </h2>

              {selectedNode ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border mb-2 ${
                        TYPE_COLORS[selectedNode.type]
                      }`}
                    >
                      {selectedNode.type}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedNode.label}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Node ID: {selectedNode.id}
                    </p>
                  </div>

                  {/* Connected Relationships */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Connected Relationships
                    </h4>

                    {graphData.edges.filter(
                      (e) =>
                        e.source === selectedNode.id ||
                        e.target === selectedNode.id,
                    ).length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">
                        No directional edges attached.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {graphData.edges
                          .filter(
                            (e) =>
                              e.source === selectedNode.id ||
                              e.target === selectedNode.id,
                          )
                          .map((edge, idx) => (
                            <div
                              key={idx}
                              className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-[11px] flex items-center justify-between gap-2"
                            >
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {edge.relation}
                              </span>
                              <span className="text-[10px] text-indigo-500 font-bold">
                                {Math.round((edge.confidence || 1) * 100)}% conf
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Neighborhood Expansion Controls */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5" /> Expansion Hops (k)
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {kHops} Hop{kHops > 1 ? "s" : ""}
                      </span>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="3"
                      value={kHops}
                      onChange={(e) => setKHops(parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-600"
                    />

                    <button
                      onClick={() => handleExpandNeighborhood(selectedNode.id)}
                      disabled={expanding}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 shadow-xs"
                    >
                      {expanding ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                      Expand {kHops}-Hop Neighborhood
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-400 space-y-1">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Select an entity to inspect
                  </p>
                  <p className="text-[11px] text-slate-400">
                    View attached relations and perform k-hop neighborhood
                    expansion
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SemanticKnowledgeGraphExplorer;
