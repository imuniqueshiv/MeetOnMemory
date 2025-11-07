import React, { useState } from "react";
import Navbar from "../components/Navbar.jsx";

const AiSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch("http://localhost:4000/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      console.log("🔍 Search results from backend:", data);

      setResults(data.results || []);
      if (data.results?.length === 0)
        setError("No matching meetings found. Try a different query.");
    } catch (err) {
      console.error("❌ Search error:", err);
      setError("Failed to fetch results. Please ensure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
      <Navbar />

      <div className="max-w-4xl mx-auto pt-28 px-6 flex flex-col items-center text-center">
        {/* Header */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-3 tracking-tight">
          🤖 Smart AI Meeting Search
        </h1>
        <p className="text-gray-600 mb-8 text-sm md:text-base max-w-2xl">
          Search across your <b>meeting transcripts</b>, <b>policies</b>, and{" "}
          <b>AI summaries</b> using natural language — powered by your intelligent semantic engine.
        </p>

        {/* Search Input */}
        <div className="w-full bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <input
              type="text"
              placeholder="Ask e.g. 'What decisions were made in the finance meeting?'"
              className="flex-grow px-5 py-3 text-sm md:text-base border border-gray-200 rounded-full shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 md:px-8 md:py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Searching...
                </span>
              ) : (
                "Search"
              )}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-left">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Search Results Section */}
        <div className="mt-10 w-full text-left">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mb-3"></div>
              <p className="text-gray-600 font-medium">Searching your meetings...</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-5">
              <p className="text-gray-600 mb-3 font-medium">
                Found {results.length} relevant meeting
                {results.length > 1 ? "s" : ""}:
              </p>

              {results.map((result, index) => (
                <div
                  key={result.meetingId || index}
                  className="group p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer"
                  onClick={() =>
                    alert(
                      `🧠 Full Summary:\n\n${
                        result.summary ||
                        result.transcript ||
                        "No summary content available."
                      }`
                    )
                  }
                >
                  {/* Title */}
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition">
                      {result.title || "Untitled Meeting"}
                    </h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                      Score: {result.similarityScore || "N/A"}
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="text-gray-700 text-sm mt-2 leading-relaxed line-clamp-3">
                    {result.summary ||
                      result.transcript?.slice(0, 200) ||
                      "No summary available."}
                  </p>

                  {/* Metadata */}
                  <div className="flex justify-between items-center text-xs text-gray-500 mt-4">
                    <span>
                      📅{" "}
                      {result.createdAt
                        ? new Date(result.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Unknown date"}
                    </span>
                    <button className="text-blue-600 font-medium hover:underline">
                      View Details →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && results.length === 0 && !error && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">
                💬 Type your question above to start exploring with AI
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiSearch;
