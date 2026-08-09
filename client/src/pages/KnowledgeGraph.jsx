import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import * as d3 from "d3";
import {
  Network,
  Search,
  Filter,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
  X,
  Users,
  Calendar,
  Target,
  CheckSquare,
  MessageSquare,
} from "lucide-react";
import { toast } from "react-toastify";

// Moved outside component to prevent re-creation on every render
const getNodeColor = (type) => {
  const colors = {
    meeting: "#3b82f6",
    person: "#10b981",
    decision: "#f59e0b",
    "action-item": "#ef4444",
    topic: "#8b5cf6",
  };
  return colors[type] || "#6b7280";
};

const getNodeIcon = (type) => {
  const icons = {
    meeting: Calendar,
    person: Users,
    decision: Target,
    "action-item": CheckSquare,
    topic: MessageSquare,
  };
  return icons[type] || Info;
};

const getEdgeColor = (type) => {
  const colors = {
    created: "#3b82f6",
    participated: "#10b981",
    produced: "#f59e0b",
    assigned: "#ef4444",
    discussed: "#8b5cf6",
    "relates-to": "#6b7280",
  };
  return colors[type] || "#9ca3af";
};

const KnowledgeGraph = () => {
  const { userData, backendUrl } = useContext(AppContent);
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [filters, setFilters] = useState({
    meetings: true,
    persons: true,
    decisions: true,
    actions: true,
    topics: true,
  });
  const [zoom, setZoom] = useState(1);

  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${backendUrl}/api/graph/organization/${userData?.organization}`,
        { credentials: "include" },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch graph");
      }

      const data = await response.json();
      setGraph(data);
    } catch (error) {
      console.error("Error fetching graph:", error);
      toast.error("Failed to load knowledge graph");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, userData?.organization]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const renderGraph = useCallback(() => {
    if (!graph || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = containerRef.current?.clientWidth || 1200;
    const height = 800;

    // Filter nodes and edges based on filters
    const filteredNodes = graph.nodes.filter((node) => {
      if (node.type === "meeting" && !filters.meetings) return false;
      if (node.type === "person" && !filters.persons) return false;
      if (node.type === "decision" && !filters.decisions) return false;
      if (node.type === "action-item" && !filters.actions) return false;
      if (node.type === "topic" && !filters.topics) return false;
      return true;
    });

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = graph.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
    );

    // Create force simulation
    const simulation = d3
      .forceSimulation(filteredNodes)
      .force(
        "link",
        d3
          .forceLink(filteredEdges)
          .id((d) => d.id)
          .distance(100),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Create container for zoom
    const container = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `scale(${zoom})`);

    // Add zoom behavior
    const zoomBehavior = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);

    // Add edges
    const link = container
      .append("g")
      .selectAll("line")
      .data(filteredEdges)
      .enter()
      .append("line")
      .attr("stroke", (d) => getEdgeColor(d.type))
      .attr("stroke-width", (d) => Math.sqrt(d.weight || 1) * 2)
      .attr("stroke-opacity", 0.6);

    // Add nodes
    const node = container
      .append("g")
      .selectAll("g")
      .data(filteredNodes)
      .enter()
      .append("g")
      .call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    // Add circles for nodes
    node
      .append("circle")
      .attr("r", (d) => {
        if (d.type === "meeting") return 20;
        if (d.type === "person") return 15;
        return 12;
      })
      .attr("fill", (d) => getNodeColor(d.type))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        setSelectedNode(d);
      });

    // Add labels
    node
      .append("text")
      .text((d) => d.label.substring(0, 20))
      .attr("x", 0)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#374151")
      .style("pointer-events", "none");

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });
  }, [graph, filters, zoom]);

  useEffect(() => {
    if (graph && svgRef.current) {
      renderGraph();
    }
  }, [graph, filters, zoom, renderGraph]);

  const searchEntities = useCallback(
    async (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        const response = await fetch(
          `${backendUrl}/api/graph/search?query=${encodeURIComponent(query)}`,
          { credentials: "include" },
        );

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = await response.json();
        setSearchResults(data.results || []);
      } catch (error) {
        console.error("Error searching:", error);
      }
    },
    [backendUrl],
  );

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length > 2) {
      searchEntities(query);
    } else {
      setSearchResults([]);
    }
  };

  const exportGraph = useCallback(
    async (format) => {
      try {
        const response = await fetch(`${backendUrl}/api/graph/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ format, orgId: userData?.organization }),
        });

        if (!response.ok) {
          throw new Error("Export failed");
        }

        if (format === "json") {
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "knowledge-graph.json";
          a.click();
          URL.revokeObjectURL(url);
        }

        toast.success(`Graph exported as ${format.toUpperCase()}`);
      } catch (error) {
        console.error("Error exporting:", error);
        toast.error("Failed to export graph");
      }
    },
    [backendUrl, userData?.organization],
  );

  const handleZoomIn = () => {
    setZoom((z) => Math.min(z * 1.2, 4));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(z / 1.2, 0.1));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const toggleFilter = (type) => {
    setFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="pt-20 flex items-center justify-center">
          <div className="text-center">
            <Network className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              Loading knowledge graph...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <div className="pt-20 max-w-[1600px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
            <Network className="w-8 h-8 text-blue-600" />
            Knowledge Graph
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Visualize relationships between meetings, people, decisions, and
            topics
          </p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-80 flex-shrink-0 space-y-4">
            {/* Search */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Search className="w-4 h-4" />
                Search Entities
              </h3>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search nodes..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
              {searchResults.length > 0 && (
                <div className="mt-3 max-h-60 overflow-y-auto space-y-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => setSelectedNode(result)}
                      className="w-full text-left px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getNodeColor(result.type) }}
                        />
                        <span className="text-sm text-slate-900 dark:text-white truncate">
                          {result.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {result.type}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter by Type
              </h3>
              <div className="space-y-2">
                {Object.entries(filters).map(([type, enabled]) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleFilter(type)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">
                      {type === "actions" ? "Action Items" : type}
                    </span>
                    <div
                      className="w-3 h-3 rounded-full ml-auto"
                      style={{
                        backgroundColor: getNodeColor(
                          type === "actions"
                            ? "action-item"
                            : type === "persons"
                              ? "person"
                              : type,
                        ),
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Zoom Controls
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleZoomIn}
                  className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4 mx-auto" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4 mx-auto" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Reset Zoom"
                >
                  <Maximize2 className="w-4 h-4 mx-auto" />
                </button>
              </div>
            </div>

            {/* Export */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export Graph
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => exportGraph("json")}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => exportGraph("csv")}
                  className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  Export as CSV
                </button>
              </div>
            </div>
          </div>

          {/* Main Graph Area */}
          <div className="flex-1">
            <div
              ref={containerRef}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg overflow-hidden"
              style={{ height: "800px" }}
            >
              <svg ref={svgRef} className="w-full h-full" />
            </div>

            {/* Legend */}
            <div className="mt-4 bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                Legend
              </h3>
              <div className="flex flex-wrap gap-4">
                {[
                  { type: "meeting", label: "Meeting" },
                  { type: "person", label: "Person" },
                  { type: "decision", label: "Decision" },
                  { type: "action-item", label: "Action Item" },
                  { type: "topic", label: "Topic" },
                ].map(({ type, label }) => (
                  <div key={type} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: getNodeColor(type) }}
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Node Details Modal */}
        {selectedNode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: getNodeColor(selectedNode.type),
                      }}
                    >
                      {React.createElement(getNodeIcon(selectedNode.type), {
                        className: "w-6 h-6 text-white",
                      })}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {selectedNode.label}
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">
                        {selectedNode.type}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                      Properties
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-2">
                      {Object.entries(selectedNode.properties).map(
                        ([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                              {key.replace(/([A-Z])/g, " $1").trim()}:
                            </span>
                            <span className="text-sm text-slate-900 dark:text-white font-medium">
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraph;
