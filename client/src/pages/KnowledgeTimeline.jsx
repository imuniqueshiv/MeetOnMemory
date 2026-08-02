import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import { knowledgeApi } from "../services";
import { MessageSquare } from "lucide-react";
import { askAssistantAbout } from "../utils/askAssistant.js";

const KnowledgeTimeline = () => {
  const { decisionId } = useParams();
  const navigate = useNavigate();

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

  const latest = lineage[0];
  const pinTitle = latest?.text
    ? latest.text.slice(0, 80)
    : "Knowledge decision";

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 pt-20">
      <Navbar />

      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Decision Timeline
          </h1>
          {decisionId && (
            <button
              type="button"
              onClick={() =>
                askAssistantAbout(navigate, {
                  type: "knowledge",
                  refId: decisionId,
                  title: pinTitle,
                })
              }
              className="inline-flex items-center gap-2 self-start rounded-lg bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50"
            >
              <MessageSquare className="w-4 h-4" />
              Ask Assistant about this
            </button>
          )}
        </div>

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
