import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import { knowledgeApi } from "../services";

const KnowledgeTimeline = () => {
  const { decisionId } = useParams();

  const [lineage, setLineage] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLineage = async () => {
      try {
        const res = await knowledgeApi.getDecisionLineage(decisionId);

        if (res.data?.success) {
          setLineage(res.data.lineage);
        }
      } catch (err) {
        console.error("Failed to load decision lineage", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLineage();
  }, [decisionId]);

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 pt-20">
      <Navbar />

      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
          Decision Timeline
        </h1>

        {loading && (
          <p className="text-slate-500 dark:text-slate-400">Loading...</p>
        )}

        {!loading && lineage.length === 0 && (
          <p className="text-slate-500 dark:text-slate-400">
            No history found.
          </p>
        )}

        <div className="space-y-4">
          {lineage.map((d) => (
            <div
              key={d._id}
              className="border-l-2 border-blue-500 pl-4 py-2 bg-white dark:bg-slate-900/50 rounded-r-lg p-3 border border-slate-100 dark:border-slate-800/80"
            >
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {new Date(d.createdAt).toLocaleDateString()} —{" "}
                {d.sourceMeetingId?.title}
              </p>

              <p className="font-medium text-slate-900 dark:text-slate-200 mt-1">
                {d.text}
              </p>

              <span className="text-[10px] uppercase text-gray-400 dark:text-slate-500 font-bold mt-1 inline-block">
                {d.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeTimeline;
