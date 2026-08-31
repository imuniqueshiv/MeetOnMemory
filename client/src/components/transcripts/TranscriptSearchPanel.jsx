import React, { useState, useEffect } from "react";
import { Search, Loader2, Calendar, User, Clock, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/apiClient.js";

const TranscriptSearchPanel = () => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchResults = async () => {
      if (!debouncedQuery.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get("/api/transcripts/search/global", {
          params: { q: debouncedQuery, speaker },
          signal: controller.signal,
        });
        if (data.success) {
          setResults(data.data.results || []);
        }
      } catch (err) {
        if (
          api.isCancel?.(err) ||
          err.name === "CanceledError" ||
          err.name === "AbortError" ||
          err.code === "ERR_CANCELED"
        ) {
          return;
        }
        console.error(err);
        setError("Failed to search transcripts.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchResults();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, speaker]);

  const highlightText = (text) => {
    if (!debouncedQuery) return text;
    const regex = new RegExp(
      `(${debouncedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi",
    );
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === debouncedQuery.toLowerCase() ? (
        <mark key={i} className="bg-yellow-300 text-black px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const handleResultClick = (meetingId, segmentIndex) => {
    navigate(
      `/transcript/${meetingId}?highlight=${encodeURIComponent(debouncedQuery)}&segment=${segmentIndex}`,
    );
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 shadow-sm rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-slate-800/50 rounded-t-xl">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Global Transcript Search
        </h2>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search exactly what was said..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="relative md:w-64">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Filter by speaker..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-[400px]">
        {loading && (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
            <p>Searching thousands of hours of audio...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {!loading && !error && results.length === 0 && debouncedQuery && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            No utterances found matching "{debouncedQuery}"
          </div>
        )}

        {!loading && !error && !debouncedQuery && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
            Enter a phrase or keyword to search across all your meetings
          </div>
        )}

        <div className="space-y-6">
          {results.map((result) => (
            <div
              key={`${result.meetingId}-${result.segmentIndex}`}
              onClick={() =>
                handleResultClick(result.meetingId, result.segmentIndex)
              }
              className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all bg-white dark:bg-slate-800 group"
            >
              <div className="flex items-center justify-between mb-4 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-3">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                    <FileText className="w-4 h-4" />
                    {result.meetingTitle || "Unknown Meeting"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date(result.meetingDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-xs font-medium bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                  Score: {result.score.toFixed(2)}
                </div>
              </div>

              <div className="pl-4 border-l-2 border-indigo-200 dark:border-indigo-900/50 space-y-3">
                {result.contextSegments?.map((seg, idx) => {
                  const isMatch = seg.text
                    .toLowerCase()
                    .includes(debouncedQuery.toLowerCase());
                  return (
                    <div
                      key={idx}
                      className={`flex gap-4 text-sm ${isMatch ? "opacity-100" : "opacity-60"}`}
                    >
                      <div className="w-24 shrink-0 text-right">
                        <div className="font-semibold text-gray-700 dark:text-gray-300 truncate">
                          {seg.speaker}
                        </div>
                        <div className="text-gray-400 text-xs mt-0.5 flex justify-end items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(seg.startTime)}
                        </div>
                      </div>
                      <div
                        className={`flex-1 text-gray-900 dark:text-gray-100 leading-relaxed ${isMatch ? "" : ""}`}
                      >
                        {isMatch ? highlightText(seg.text) : seg.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TranscriptSearchPanel;
