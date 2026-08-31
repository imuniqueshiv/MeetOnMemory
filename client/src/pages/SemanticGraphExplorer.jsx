import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  CheckSquare,
  MessageSquare,
  Network,
  RefreshCw,
  Search,
  Share2,
  Target,
  Users,
} from "lucide-react";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import OrganizationEmptyState from "../components/organization/OrganizationEmptyState";
import { meetingApi } from "../services";
import {
  extractMeetingSemanticGraph,
  getSemanticNeighborhood,
} from "../services/semanticGraphApi";

/**
 * Semantic knowledge graph explorer (Issue #2446).
 *
 * Surfaces the `/api/semantic-graph` extract and k-hop neighborhood endpoints:
 * extract the entity-relation graph of one meeting, search the entities, expand
 * any entity across the organization's meetings, and jump to source meetings.
 */

const HOP_OPTIONS = [1, 2, 3];

/** Entities are plotted on a ring; beyond this the SVG stops being readable. */
const MAX_PLOTTED_NODES = 40;

const TYPE_META = {
  MEETING: { label: "Meetings", color: "#3b82f6", icon: Calendar },
  PERSON: { label: "People", color: "#10b981", icon: Users },
  DECISION: { label: "Decisions", color: "#f59e0b", icon: Target },
  ACTION_ITEM: { label: "Action items", color: "#ef4444", icon: CheckSquare },
  TOPIC: { label: "Topics", color: "#8b5cf6", icon: MessageSquare },
};

const typeMeta = (type) =>
  TYPE_META[type] || {
    label: type || "Entity",
    color: "#6b7280",
    icon: Network,
  };

const emptyGraph = () => ({ nodes: [], edges: [] });

/**
 * Meeting a node originates from, derived from the id shapes the extraction
 * service emits (`meeting-<id>`, `decision-<id>-<idx>`, `action-<id>-<idx>`).
 * People and topics span meetings, so they resolve to nothing.
 */
const getSourceMeetingId = (nodeId) => {
  if (typeof nodeId !== "string") return "";
  const patterns = [
    /^meeting-(.+)$/,
    /^decision-(.+)-\d+$/,
    /^action-(.+)-\d+$/,
  ];
  for (const pattern of patterns) {
    const match = nodeId.match(pattern);
    if (match) return match[1];
  }
  return "";
};

/** Deterministic ring layout — no simulation, so renders are stable in tests. */
const layoutNodes = (nodes, width, height) => {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 36;

  return nodes.map((node, index) => {
    if (nodes.length === 1) return { ...node, x: cx, y: cy };
    const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
    return {
      ...node,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
};

const SemanticGraphExplorer = () => {
  const { userData, loading: authLoading } = useContext(AppContent) || {};
  const organizationId =
    userData?.organization?._id || userData?.organization || null;

  const [meetings, setMeetings] = useState([]);
  const [meetingId, setMeetingId] = useState("");
  const [meetingGraph, setMeetingGraph] = useState(emptyGraph);
  const [neighborhood, setNeighborhood] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [kHops, setKHops] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !organizationId) return;

    let active = true;
    meetingApi
      .getAllMeetings()
      .then((res) => {
        if (!active) return;
        const payload = res?.data;
        setMeetings(payload?.success ? payload.meetings || [] : []);
      })
      .catch(() => {
        if (active) setMeetings([]);
      });

    return () => {
      active = false;
    };
  }, [authLoading, organizationId]);

  const extractGraph = useCallback(async (id) => {
    if (!id) return;

    setLoading(true);
    setError("");
    setNeighborhood(null);
    setSelectedNodeId("");
    try {
      setMeetingGraph(await extractMeetingSemanticGraph(id));
    } catch (err) {
      setMeetingGraph(emptyGraph());
      setError(
        err.response?.data?.error || "Failed to extract the semantic graph.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMeetingChange = (event) => {
    const id = event.target.value;
    setMeetingId(id);
    setSearch("");
    if (id) extractGraph(id);
    else setMeetingGraph(emptyGraph());
  };

  const expandNeighborhood = async (seedNode) => {
    setLoading(true);
    setError("");
    try {
      const graph = await getSemanticNeighborhood(seedNode.id, kHops);
      setNeighborhood({ seed: seedNode, kHops, graph });
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to expand the neighborhood.",
      );
    } finally {
      setLoading(false);
    }
  };

  const activeGraph = neighborhood ? neighborhood.graph : meetingGraph;

  const visibleGraph = useMemo(() => {
    const query = search.trim().toLowerCase();
    const nodes = query
      ? activeGraph.nodes.filter((node) =>
          String(node.label || "")
            .toLowerCase()
            .includes(query),
        )
      : activeGraph.nodes;

    const visibleIds = new Set(nodes.map((node) => node.id));
    const edges = activeGraph.edges.filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    );

    return { nodes, edges };
  }, [activeGraph, search]);

  const nodeLabels = useMemo(
    () => new Map(activeGraph.nodes.map((node) => [node.id, node.label])),
    [activeGraph],
  );

  const groupedNodes = useMemo(() => {
    const groups = new Map();
    visibleGraph.nodes.forEach((node) => {
      if (!groups.has(node.type)) groups.set(node.type, []);
      groups.get(node.type).push(node);
    });
    return Array.from(groups, ([type, nodes]) => ({ type, nodes }));
  }, [visibleGraph]);

  const plotted = useMemo(
    () => layoutNodes(visibleGraph.nodes.slice(0, MAX_PLOTTED_NODES), 720, 360),
    [visibleGraph],
  );

  const plottedPositions = useMemo(
    () => new Map(plotted.map((node) => [node.id, node])),
    [plotted],
  );

  const selectedNode =
    visibleGraph.nodes.find((node) => node.id === selectedNodeId) || null;
  const sourceMeetingId = selectedNode
    ? getSourceMeetingId(selectedNode.id)
    : "";

  if (!authLoading && !organizationId) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="flex-grow container mx-auto px-4 pt-24 pb-12 flex">
          <OrganizationEmptyState />
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="semantic-graph-explorer"
      className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900"
    >
      <Navbar />
      <div className="flex-grow container mx-auto px-4 pt-24 pb-12 sm:pt-28 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Share2 className="h-7 w-7 text-blue-600" aria-hidden="true" />
            Semantic Graph Explorer
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Extract the entities and relationships behind a meeting, search
            them, expand any entity across the organization, and open the
            meetings they came from.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
            Meeting
            <select
              value={meetingId}
              onChange={handleMeetingChange}
              aria-label="Select a meeting to extract"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select a meeting</option>
              {meetings.map((meeting) => (
                <option key={meeting._id} value={meeting._id}>
                  {meeting.title || "Untitled meeting"}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
            Search entities
            <span className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter by entity name"
                aria-label="Search entities"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
            Neighborhood hops
            <select
              value={kHops}
              onChange={(event) => setKHops(Number(event.target.value))}
              aria-label="Neighborhood hops"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {HOP_OPTIONS.map((hops) => (
                <option key={hops} value={hops}>
                  {hops} hop{hops > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-gray-800 p-4 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </div>
        )}

        {neighborhood && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Showing the {neighborhood.kHops}-hop neighborhood of{" "}
              <strong>{neighborhood.seed.label}</strong>.
            </p>
            <button
              type="button"
              onClick={() => {
                setNeighborhood(null);
                setSelectedNodeId("");
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-200"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Back to meeting graph
            </button>
          </div>
        )}

        {loading && (
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Loading semantic graph…
          </p>
        )}

        {!meetingId && !loading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a meeting to extract its semantic graph.
          </p>
        )}

        {meetingId && !loading && visibleGraph.nodes.length === 0 && (
          <p
            data-testid="semantic-graph-empty"
            className="text-sm text-gray-500 dark:text-gray-400"
          >
            No entities to show.
          </p>
        )}

        {visibleGraph.nodes.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  {visibleGraph.nodes.length} entities,{" "}
                  {visibleGraph.edges.length} relations
                </h2>
                <svg
                  viewBox="0 0 720 360"
                  className="w-full h-auto"
                  aria-hidden="true"
                  focusable="false"
                >
                  {visibleGraph.edges.map((edge, index) => {
                    const from = plottedPositions.get(edge.source);
                    const to = plottedPositions.get(edge.target);
                    if (!from || !to) return null;
                    return (
                      <line
                        key={`${edge.source}-${edge.target}-${edge.relation}-${index}`}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="#cbd5f5"
                        strokeWidth="1.5"
                      />
                    );
                  })}
                  {plotted.map((node) => (
                    <g key={node.id}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="9"
                        fill={typeMeta(node.type).color}
                      />
                      <text
                        x={node.x}
                        y={node.y - 14}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#6b7280"
                      >
                        {String(node.label || "").slice(0, 22)}
                      </text>
                    </g>
                  ))}
                </svg>
                {visibleGraph.nodes.length > MAX_PLOTTED_NODES && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Plotting the first {MAX_PLOTTED_NODES} of{" "}
                    {visibleGraph.nodes.length} entities. Narrow the search to
                    see the rest.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Relations
                </h2>
                <ul className="space-y-2">
                  {visibleGraph.edges.map((edge, index) => (
                    <li
                      key={`${edge.source}-${edge.target}-${edge.relation}-${index}`}
                      className="text-sm text-gray-700 dark:text-gray-300"
                    >
                      {nodeLabels.get(edge.source) || edge.source}{" "}
                      <span className="font-mono text-xs text-blue-700 dark:text-blue-300">
                        {edge.relation}
                      </span>{" "}
                      {nodeLabels.get(edge.target) || edge.target}
                    </li>
                  ))}
                  {visibleGraph.edges.length === 0 && (
                    <li className="text-sm text-gray-500 dark:text-gray-400">
                      No relations between the visible entities.
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Entities
                </h2>
                {groupedNodes.map(({ type, nodes }) => {
                  const meta = typeMeta(type);
                  const Icon = meta.icon;
                  return (
                    <div key={type} className="mb-4 last:mb-0">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        <Icon
                          className="h-4 w-4"
                          style={{ color: meta.color }}
                          aria-hidden="true"
                        />
                        {meta.label} ({nodes.length})
                      </p>
                      <ul className="space-y-1">
                        {nodes.map((node) => (
                          <li key={node.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedNodeId(node.id)}
                              aria-pressed={selectedNodeId === node.id}
                              className={`w-full text-left px-3 py-2 text-sm rounded-lg border ${
                                selectedNodeId === node.id
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200"
                                  : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {node.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {selectedNode && (
                <div
                  data-testid="semantic-node-details"
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                >
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {selectedNode.label}
                  </h2>
                  <p className="mt-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {typeMeta(selectedNode.type).label}
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => expandNeighborhood(selectedNode)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
                    >
                      <Network className="h-4 w-4" aria-hidden="true" />
                      Expand neighborhood
                    </button>
                    {sourceMeetingId && (
                      <Link
                        to={`/meetings/${sourceMeetingId}`}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                        Open source meeting
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SemanticGraphExplorer;
