import { useState, useEffect, useMemo } from "react";
import { getAllDecisionGraphPages } from "../services/decisionGraphApi";

const useDecisionGraph = () => {
  const [data, setData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [keywordFilter, setKeywordFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let isCurrent = true;

    const fetchGraph = async () => {
      try {
        setLoading(true);
        setError(null);
        const graphData = await getAllDecisionGraphPages();
        if (isCurrent) {
          setData(graphData);
        }
      } catch (err) {
        if (isCurrent) {
          setError(err.message || "Failed to fetch decision graph");
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    };
    fetchGraph();

    return () => {
      isCurrent = false;
    };
  }, []);

  // Filter logic: when filters change, we compute the visible subset of nodes and edges
  const filteredData = useMemo(() => {
    let filteredNodes = data.nodes;

    if (statusFilter !== "all") {
      filteredNodes = filteredNodes.filter((n) => n.status === statusFilter);
    }

    if (keywordFilter.trim()) {
      const lowerKeyword = keywordFilter.toLowerCase();
      filteredNodes = filteredNodes.filter(
        (n) =>
          n.label.toLowerCase().includes(lowerKeyword) ||
          (n.owner && n.owner.toLowerCase().includes(lowerKeyword)),
      );
    }

    const validNodeIds = new Set(filteredNodes.map((n) => n.id));

    // Only keep edges where both source and target are in the filtered nodes
    const filteredEdges = data.edges.filter(
      (e) => validNodeIds.has(e.source) && validNodeIds.has(e.target),
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [data, keywordFilter, statusFilter]);

  return {
    data,
    filteredData,
    loading,
    error,
    keywordFilter,
    setKeywordFilter,
    statusFilter,
    setStatusFilter,
  };
};

export default useDecisionGraph;
