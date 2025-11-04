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
    setResults([]); // Clear previous results

    try {
      const res = await fetch("http://localhost:4000/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      
      // ✅ Debug log to see what backend returns
      console.log("🔍 Search results from backend:", data);
      
      setResults(data.results || []);
      
      if (data.results?.length === 0) {
        setError("No matching meetings found. Try a different query.");
      }
    } catch (err) {
      console.error("❌ Search error:", err);
      setError("Failed to fetch results. Please check if the server is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto text-center pt-28 px-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          🤖 AI-Powered Search
        </h1>
        <p className="text-gray-600 mb-6">
          Ask anything about your meetings, policies, or decisions — powered by semantic AI search.
        </p>

        {/* Search Box */}
        <div className="bg-white p-8 rounded-2xl shadow-lg">
          <input
            type="text"
            placeholder="e.g. discipline meeting"
            className="w-full px-5 py-3 border rounded-full shadow-sm focus:ring-2 focus:ring-blue-400 outline-none mb-4"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Results */}
        <div className="mt-8 text-left">
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
              <p className="text-gray-500 mt-2">Searching through meetings...</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-4">
              <p className="text-gray-600 mb-4">
                Found {results.length} relevant meeting{results.length > 1 ? 's' : ''}:
              </p>
              
              {results.map((result, index) => (
                <div
                  key={result.meetingId || index}
                  className="p-5 bg-white rounded-xl shadow-sm hover:shadow-md transition cursor-pointer border border-gray-100"
                  onClick={() => {
                    // Navigate to meeting details or show full transcript
                    console.log("Meeting clicked:", result);
                    alert(`Full Summary:\n\n${result.summary || result.transcript || "No content available"}`);
                  }}
                >
                  {/* Title */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {result.title || "Untitled Meeting"}
                  </h3>
                  
                  {/* Summary */}
                  <p className="text-gray-700 text-sm mb-3 line-clamp-2">
                    {result.summary || "No summary available"}
                  </p>
                  
                  {/* Metadata Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      📅 {result.createdAt 
                        ? new Date(result.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : "Unknown date"}
                    </span>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                      Score: {result.similarityScore || "N/A"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && results.length === 0 && !error && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">
                🔍 Type your question above to search with AI
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiSearch;