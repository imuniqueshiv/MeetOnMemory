import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  X,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Loader2,
} from "lucide-react";
import useDecisionGraph from "../hooks/useDecisionGraph";
import DecisionGraphEditor from "../components/decision-graph/DecisionGraphEditor";

const DecisionGraph = () => {
  const {
    data,
    filteredData,
    loading,
    error,
    keywordFilter,
    setKeywordFilter,
    statusFilter,
    setStatusFilter,
    refetch,
  } = useDecisionGraph();

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    if (
      loading ||
      error ||
      !filteredData ||
      !canvasRef.current ||
      !containerRef.current
    )
      return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const container = containerRef.current;

    // Set high-DPI canvas
    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.scale(dpr, dpr);

    // Create a copy of data for d3 mutation
    const nodes = filteredData.nodes.map((d) => Object.create(d));
    const links = filteredData.edges.map((d) => Object.create(d));

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(150),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3.forceCollide().radius((d) => (d.importanceScore || 10) + 10),
      );

    let transform = d3.zoomIdentity;

    const draw = () => {
      context.save();
      context.clearRect(0, 0, width, height);
      context.translate(transform.x, transform.y);
      context.scale(transform.k, transform.k);

      // Draw links
      links.forEach((link) => {
        context.beginPath();
        context.moveTo(link.source.x, link.source.y);
        context.lineTo(link.target.x, link.target.y);
        context.strokeStyle =
          link.type === "supersededBy" ? "#ef4444" : "#94a3b8";
        context.setLineDash(link.type === "supersededBy" ? [5, 5] : []);
        context.lineWidth = 2;
        context.globalAlpha = 0.6;
        context.stroke();
      });
      context.setLineDash([]);
      context.globalAlpha = 1;

      // Draw nodes
      nodes.forEach((node) => {
        const radius = Math.max(
          10,
          Math.min(30, (node.importanceScore || 10) / 2),
        );
        context.beginPath();
        context.moveTo(node.x + radius, node.y);
        context.arc(node.x, node.y, radius, 0, 2 * Math.PI);

        if (node.isSuperseded) {
          context.fillStyle = "#cbd5e1"; // gray for superseded
        } else {
          switch (node.status) {
            case "open":
              context.fillStyle = "#3b82f6";
              break; // blue
            case "in-progress":
              context.fillStyle = "#eab308";
              break; // yellow
            case "resolved":
              context.fillStyle = "#22c55e";
              break; // green
            default:
              context.fillStyle = "#94a3b8"; // default gray
          }
        }

        context.fill();
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.stroke();

        // Node label
        context.fillStyle = "#1e293b";
        context.font = "12px Inter, sans-serif";
        context.textAlign = "center";
        const label =
          node.label.length > 20
            ? node.label.substring(0, 17) + "..."
            : node.label;
        context.fillText(label, node.x, node.y + radius + 14);
      });

      context.restore();
    };

    simulation.on("tick", draw);

    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (e) => {
        transform = e.transform;
        draw();
      });

    d3.select(canvas).call(zoom);

    // Node click detection
    d3.select(canvas).on("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * dpr;
      const y = (e.clientY - rect.top) * dpr;

      const mouseX = (x / dpr - transform.x) / transform.k;
      const mouseY = (y / dpr - transform.y) / transform.k;

      // Find clicked node
      let clickedNode = null;
      for (let i = nodes.length - 1; i >= 0; --i) {
        const node = nodes[i];
        const radius = Math.max(
          10,
          Math.min(30, (node.importanceScore || 10) / 2),
        );
        const dx = mouseX - node.x;
        const dy = mouseY - node.y;
        if (dx * dx + dy * dy < radius * radius) {
          clickedNode = node;
          break;
        }
      }

      setSelectedNode(clickedNode);
    });

    // Handle window resize
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      canvas.width = newWidth * dpr;
      canvas.height = newHeight * dpr;
      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${newHeight}px`;
      context.scale(dpr, dpr);
      simulation.force("center", d3.forceCenter(newWidth / 2, newHeight / 2));
      simulation.alpha(0.3).restart();
      draw();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      simulation.stop();
      window.removeEventListener("resize", handleResize);
    };
  }, [filteredData, loading, error]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-red-500 bg-red-50 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link
            to="/organizations"
            className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-semibold">Decision Dependency Graph</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search decisions..."
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 bg-gray-100 dark:bg-gray-700 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-600 transition-all outline-none"
            />
          </div>
          <div className="relative">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="superseded">Superseded</option>
            </select>
          </div>
        </div>
      </div>

      {/* Decision editor (create / link / supersede) — RBAC-gated (#2027) */}
      <div className="px-6 pt-4">
        <DecisionGraphEditor nodes={data?.nodes || []} onChanged={refetch} />
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Canvas Container */}
        <div
          ref={containerRef}
          className="flex-1 h-full cursor-grab active:cursor-grabbing relative"
        >
          <canvas ref={canvasRef} className="absolute inset-0" />

          {/* Legend */}
          <div className="absolute bottom-6 left-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 pointer-events-none">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              Legend
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div> Open
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div> In
                Progress
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>{" "}
                Resolved
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-300"></div>{" "}
                Superseded
              </div>
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 border-b-2 border-slate-400"></div>{" "}
                  Relates To
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 border-b-2 border-dashed border-red-500"></div>{" "}
                  Supersedes
                </div>
              </div>
            </div>
          </div>

          {/* Empty State Overlay */}
          {filteredData && filteredData.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl text-center shadow-lg border border-gray-200 dark:border-gray-700 max-w-md">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  No decisions found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {keywordFilter || statusFilter !== "all"
                    ? "Try adjusting your search filters to find what you're looking for."
                    : "There are no decisions in your organization yet. Decisions will appear here once they are created in your meetings."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Panel */}
        {selectedNode && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 h-full overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-right">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
              <h2 className="font-semibold text-lg leading-tight">
                {selectedNode.label}
              </h2>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-5">
              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">
                  Status
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                  ${
                    selectedNode.status === "open"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      : selectedNode.status === "resolved"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : selectedNode.status === "in-progress"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {selectedNode.status}
                </span>
                {selectedNode.isSuperseded && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    Superseded
                  </span>
                )}
              </div>

              {selectedNode.owner && (
                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">
                    Owner
                  </div>
                  <div className="text-sm">{selectedNode.owner}</div>
                </div>
              )}

              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">
                  Importance Score
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, selectedNode.importanceScore)}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round(selectedNode.importanceScore)}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">
                  Source Meeting
                </div>
                <Link
                  to={`/meeting/${selectedNode.sourceMeetingId}`}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View Meeting
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DecisionGraph;
