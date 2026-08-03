import React, { useState, useEffect, useContext, useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import AppContent from "../context/AppContent.js";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00C49F",
  "#FFBB28",
];

const TopicExplorer = () => {
  const { getToken } = useAuth();
  const { userData } = useContext(AppContent);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState(null);

  const orgId = userData?.organization?._id || userData?.organization;

  useEffect(() => {
    if (orgId) {
      fetchClusters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchClusters = async () => {
    try {
      const token = await getToken();
      if (!orgId) return;

      const res = await axios.get(`/api/topics/clusters/org/${orgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClusters(res.data.data);
    } catch (error) {
      console.error("Error fetching clusters", error);
    } finally {
      setLoading(false);
    }
  };

  const renameCluster = async (clusterId, newLabel) => {
    try {
      const token = await getToken();
      await axios.put(
        `/api/topics/clusters/${clusterId}`,
        { label: newLabel },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      fetchClusters(); // Refresh
    } catch (error) {
      console.error("Error renaming cluster", error);
    }
  };

  // Prepare data for bubble chart
  const chartData = useMemo(() => {
    return clusters.map((c, index) => ({
      name: c.label,
      count: c.meetingCount,
      // Assign random x/y for scatter plot visualization to spread them out
      x: Math.random() * 100,
      y: Math.random() * 100,
      fill: COLORS[index % COLORS.length],
      ...c,
    }));
  }, [clusters]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Topic Explorer</h1>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow h-96">
              <h2 className="text-xl font-semibold mb-4">
                Topic Clusters Overview
              </h2>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <XAxis type="number" dataKey="x" name="x" hide />
                  <YAxis type="number" dataKey="y" name="y" hide />
                  <ZAxis
                    type="number"
                    dataKey="count"
                    range={[100, 1000]}
                    name="Meetings"
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ payload }) => {
                      if (payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-2 border shadow rounded text-sm text-gray-800">
                            <p className="font-bold">{data.name}</p>
                            <p>Meetings: {data.count}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter
                    name="Topics"
                    data={chartData}
                    onClick={(e) => setSelectedCluster(e.payload)}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clusters.map((cluster) => (
                <div
                  key={cluster._id}
                  className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow cursor-pointer transition ${selectedCluster?._id === cluster._id ? "ring-2 ring-blue-500" : "hover:shadow-md"}`}
                  onClick={() => setSelectedCluster(cluster)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg">{cluster.label}</h3>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {cluster.meetingCount} meetings
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mb-2">
                    {cluster.canonicalTopicNames?.slice(0, 3).join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            {selectedCluster ? (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow sticky top-6">
                <h2 className="text-2xl font-bold mb-2">
                  {selectedCluster.label}
                </h2>
                <button
                  className="text-sm text-blue-500 hover:underline mb-4"
                  onClick={() => {
                    const newLabel = prompt(
                      "Enter new label:",
                      selectedCluster.label,
                    );
                    if (newLabel && newLabel !== selectedCluster.label) {
                      renameCluster(selectedCluster._id, newLabel);
                    }
                  }}
                >
                  Rename Cluster
                </button>
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300">
                    Meetings
                  </h4>
                  <p className="text-3xl font-bold text-blue-600">
                    {selectedCluster.meetingCount}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Canonical Names
                  </h4>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {selectedCluster.canonicalTopicNames?.map((name, i) => (
                      <li key={i}>{name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 h-full flex items-center justify-center text-gray-500 text-center">
                Select a cluster to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TopicExplorer;
