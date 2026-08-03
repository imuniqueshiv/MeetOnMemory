import React, { useState, useMemo } from "react";
import Navbar from "../components/Navbar.jsx";
import NoteSearchBar from "../components/notes/NoteSearchBar.jsx";
import { FileText, Tag, Trash2, Calendar, Sparkles } from "lucide-react";

/**
 * HomePage component rendering notes in a responsive grid
 * with real-time search bar and title/content/tag filtering.
 */
const HomePage = ({ initialNotes = [] }) => {
  const [notes, setNotes] = useState(initialNotes);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Real-time memoized note filtering
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const query = searchQuery.toLowerCase().trim();

    return notes.filter((note) => {
      const matchTitle = note.title?.toLowerCase().includes(query);
      const matchContent = note.content?.toLowerCase().includes(query);
      const matchTags = note.tags?.some((t) => t.toLowerCase().includes(query));

      switch (filterType) {
        case "title":
          return matchTitle;
        case "content":
          return matchContent;
        case "tags":
          return matchTags;
        default:
          return matchTitle || matchContent || matchTags;
      }
    });
  }, [notes, searchQuery, filterType]);

  const handleClear = () => {
    setSearchQuery("");
    setFilterType("all");
  };

  const handleDelete = (noteId) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId && n._id !== noteId));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-12">
        <header className="mb-8 text-center sm:text-left flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="text-blue-600 dark:text-blue-400" />
              Notes & Memories
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Search and manage your meeting notes in real-time
            </p>
          </div>
          <div className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium flex items-center gap-1">
            <Sparkles size={14} />
            {filteredNotes.length}{" "}
            {filteredNotes.length === 1 ? "note" : "notes"} available
          </div>
        </header>

        {/* Real-time Search and Filter Section */}
        <section className="mb-8" aria-label="Search and Filter">
          <NoteSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterType={filterType}
            onFilterTypeChange={setFilterType}
            onClear={handleClear}
          />
        </section>

        {/* Notes Grid or Empty State */}
        {filteredNotes.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center my-8">
            <div className="inline-flex p-4 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-400 mb-4">
              <FileText size={32} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {searchQuery ? "No matching notes found" : "No notes available"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1 mb-6">
              {searchQuery
                ? `No notes matched your search query "${searchQuery}". Try searching with a different term.`
                : "You haven't added any notes yet. Create notes from your meeting transcripts."}
            </p>
            {searchQuery && (
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNotes.map((note) => (
              <div
                key={note.id || note._id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h2 className="font-semibold text-lg text-gray-900 dark:text-white line-clamp-1">
                      {note.title || "Untitled Note"}
                    </h2>
                    <button
                      onClick={() => handleDelete(note.id || note._id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      aria-label="Delete note"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-4">
                    {note.content}
                  </p>
                </div>

                <div>
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {note.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-md"
                        >
                          <Tag size={10} />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {note.createdAt && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar size={12} />
                      <span>
                        {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;
