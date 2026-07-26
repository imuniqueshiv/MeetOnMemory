import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "../components/Navbar.jsx";
import SearchBar from "../components/ai-search/SearchBar.jsx";
import SearchFilters from "../components/ai-search/SearchFilters.jsx";
import SearchResultCard from "../components/ai-search/SearchResultCard.jsx";
import HybridResultCard from "../components/ai-search/HybridResultCard.jsx";
import HybridSearchToggle from "../components/ai-search/HybridSearchToggle.jsx";
import SearchSkeleton from "../components/ai-search/SearchSkeleton.jsx";
import SearchEmptyState from "../components/ai-search/SearchEmptyState.jsx";
import { apiClient } from "../services";

// Modal Component for showing full details
const ResultModal = ({ result, onClose }) => {
  const { t } = useTranslation();
  if (!result) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {result.title || t("aiSearch.untitledMeeting")}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
          ></button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">
              {t("aiSearch.summary")}
            </h3>
            <p className="text-gray-700 mt-1 leading-relaxed">
              {result.summary || result.transcript || t("aiSearch.noSummary")}
            </p>
          </div>

          {result.transcript && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase">
                {t("aiSearch.transcript")}
              </h3>
              <p className="text-gray-600 text-sm mt-1 leading-relaxed max-h-40 overflow-y-auto bg-gray-50 p-3 rounded-lg">
                {result.transcript}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">{t("aiSearch.date")}</span>
              <p className="font-medium text-gray-800">
                {result.createdAt
                  ? new Date(result.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : t("aiSearch.unknown")}
              </p>
            </div>
            <div>
              <span className="text-gray-500">
                {t("aiSearch.similarityScore")}
              </span>
              <p className="font-medium text-gray-800">
                {result.similarityScore || "N/A"}
              </p>
            </div>
          </div>

          {result.tags && result.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase">
                {t("aiSearch.tags")}
              </h3>
              <div className="flex flex-wrap gap-2 mt-1">
                {result.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
        >
          {t("aiSearch.close")}
        </button>
      </div>
    </div>
  );
};

const AiSearch = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedResult, setSelectedResult] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState({
    resultType: "all",
    dateFrom: "",
    dateTo: "",
    sortBy: "relevance",
  });
  const [searchMode, setSearchMode] = useState("standard"); // "standard" | "hybrid"
  const [hybridWeights, setHybridWeights] = useState({
    semanticWeight: 0.7,
    graphWeight: 0.3,
  });

  const handleSearch = async () => {
    if (!query.trim()) {
      setError(t("aiSearch.enterQuery"));
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);
    setHasSearched(true);

    try {
      if (searchMode === "hybrid") {
        const res = await apiClient.post("/api/search/hybrid", {
          query,
          ...hybridWeights,
        });
        setResults(res.data.results || []);
      } else {
        const res = await apiClient.post("/api/ai-search", { query, filters });
        const data = res.data;

        let sortedResults = data.results || [];

        if (filters.sortBy === "date-desc") {
          sortedResults.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
          );
        } else if (filters.sortBy === "date-asc") {
          sortedResults.sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
          );
        }

        setResults(sortedResults);
      }
    } catch (err) {
      console.error("❌ Search error:", err);

      if (err.message === "Failed to fetch") {
        setError(t("aiSearch.unableToConnect"));
      } else if (err.message.includes("500")) {
        setError(t("aiSearch.serverError"));
      } else if (err.message.includes("404")) {
        setError(t("aiSearch.serviceNotFound"));
      } else {
        setError(err.message || t("aiSearch.fetchFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setError("");
    setHasSearched(false);
  };

  const handleViewDetails = (result) => {
    setSelectedResult(result);
  };

  const handleOpenMeeting = (result) => {
    window.open(`/meetings/${result.meetingId}`, "_blank");
  };

  const handleOpenMeetingById = (meetingId) => {
    if (meetingId) window.open(`/meetings/${meetingId}`, "_blank");
  };

  const handleCopySummary = async (result) => {
    const textToCopy = result.summary || result.transcript || "";
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        alert(t("aiSearch.copiedToClipboard"));
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      <Navbar />

      <div className="max-w-4xl mx-auto pt-28 px-6 flex flex-col items-center text-center">
        {/* Header */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">
          {t("aiSearch.title")}
        </h1>
        <p
          className="text-gray-600 dark:text-gray-400 mb-8 text-sm md:text-base max-w-2xl"
          dangerouslySetInnerHTML={{ __html: t("aiSearch.subtitle") }}
        />

        {/* Search Input */}
        <SearchBar
          query={query}
          setQuery={setQuery}
          onSearch={handleSearch}
          loading={loading}
          onClear={handleClear}
        />

        <HybridSearchToggle
          mode={searchMode}
          setMode={setSearchMode}
          weights={hybridWeights}
          setWeights={setHybridWeights}
        />

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm text-left w-full">
            <span className="font-semibold">
              ⚠️{" "}
              {error.includes("Unable to connect") ||
              error.includes(t("aiSearch.unableToConnect").substring(0, 10))
                ? t("aiSearch.connectionError")
                : t("aiSearch.error")}
            </span>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Search Results Section */}
        <div className="mt-10 w-full text-left">
          {loading && <SearchSkeleton />}

          {!loading && results.length > 0 && (
            <>
              {searchMode === "standard" && (
                <SearchFilters
                  filters={filters}
                  setFilters={setFilters}
                  resultCount={results.length}
                />
              )}
              <div className="space-y-5">
                {searchMode === "hybrid"
                  ? results.map((result, index) => (
                      <HybridResultCard
                        key={result.key || index}
                        result={result}
                        onOpenMeeting={handleOpenMeetingById}
                      />
                    ))
                  : results.map((result, index) => (
                      <SearchResultCard
                        key={result.meetingId || index}
                        result={result}
                        onViewDetails={handleViewDetails}
                        onOpenMeeting={handleOpenMeeting}
                        onCopySummary={handleCopySummary}
                      />
                    ))}
              </div>
            </>
          )}

          {!loading && results.length === 0 && (
            <SearchEmptyState hasSearched={hasSearched} />
          )}
        </div>
      </div>

      {/* Result Modal */}
      {selectedResult && (
        <ResultModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </div>
  );
};

export default AiSearch;
