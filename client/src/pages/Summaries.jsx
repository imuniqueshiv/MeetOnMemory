import React, { useEffect, useState, useContext } from "react";
import Navbar from "../components/Navbar.jsx";
import axios from "axios";
import { AppContent } from "../context/AppContext.jsx";
import { toast } from "react-toastify";
import { FileText, Loader2, Search } from "lucide-react";

/**
 * Summaries.jsx
 * Displays all stored meeting summaries and allows searching through them.
 * Backend endpoint:
 *   GET /api/meetings/all
 *   GET /api/meetings/:id (optional, for detailed view)
 */

const Summaries = () => {
  const { backendUrl } = useContext(AppContent);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Fetch summaries from backend
  useEffect(() => {
    const fetchSummaries = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/meetings/all`, {
          withCredentials: true,
        });

        if (res.data?.success) {
          setSummaries(res.data.meetings || []);
        } else {
          toast.error(res.data?.message || "Failed to load summaries");
        }
      } catch (error) {
        console.error("Error fetching summaries:", error);
        toast.error("Unable to fetch meeting summaries.");
      } finally {
        setLoading(false);
      }
    };

    fetchSummaries();
  }, [backendUrl]);

  const filteredSummaries = summaries.filter(
    (m) =>
      m.title?.toLowerCase().includes(search.toLowerCase()) ||
      m.summary?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      {/* Centered Container */}
      <div className="flex flex-col items-center justify-center flex-grow px-6 py-20 md:py-28">
        <div className="w-full max-w-5xl text-center">
          {/* Header */}
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            🧠 AI Meeting Summaries
          </h1>
          <p className="text-gray-600 mb-8">
            Review automatically generated <b>Minutes of Meeting</b>, action items, and insights from all recorded sessions.
          </p>

          {/* Search Bar */}
          <div className="flex items-center justify-center mb-10">
            <div className="flex items-center w-full sm:w-[28rem] bg-white shadow-sm border border-gray-200 rounded-full overflow-hidden">
              <input
                type="text"
                placeholder="Search meetings by title or keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-grow px-4 py-2 text-sm text-gray-700 focus:outline-none"
              />
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-r-full hover:bg-blue-700 transition flex items-center gap-2"
                onClick={() => toast.info("Search updated")}
              >
                <Search size={16} /> Search
              </button>
            </div>
          </div>

          {/* Main Section */}
          {loading ? (
            <div className="flex justify-center items-center py-10 text-gray-500">
              <Loader2 className="animate-spin w-6 h-6 mr-2" /> Loading summaries...
            </div>
          ) : filteredSummaries.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
              {filteredSummaries.map((summary) => (
                <div
                  key={summary._id}
                  className="bg-white w-full max-w-sm rounded-2xl shadow-md hover:shadow-lg border border-gray-100 transition-all duration-300 p-6 text-left hover:-translate-y-1"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <FileText className="w-6 h-6 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {summary.title || "Untitled Meeting"}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    {summary.createdAt
                      ? new Date(summary.createdAt).toLocaleString()
                      : "Unknown date"}
                  </p>
                  <p className="text-gray-700 text-sm line-clamp-5 whitespace-pre-wrap">
                    {summary.summary ||
                      summary.transcript?.slice(0, 200) + "..."}
                  </p>

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(summary.summary);
                        toast.success("Summary copied!");
                      }}
                      className="text-sm px-4 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Copy
                    </button>

                    <button
                      onClick={() => {
                        const blob = new Blob(
                          [summary.summary || summary.transcript || ""],
                          { type: "text/plain;charset=utf-8" }
                        );
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${summary.title || "meeting"}_summary.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="text-sm px-4 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 ml-auto"
                    >
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-10 rounded-2xl shadow-md border border-gray-100">
              <p className="text-gray-500">
                No meeting summaries found. Upload and transcribe your first meeting to get started!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Summaries;
