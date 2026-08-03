import React, { useEffect, useState } from "react";
import { Search, Pin, ChevronRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { personalNoteApi } from "../services";

const PersonalNotesSidebar = () => {
  const [pinnedNotes, setPinnedNotes] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPinnedNotes();
  }, []);

  const fetchPinnedNotes = async () => {
    try {
      setLoading(true);
      const { data } = await personalNoteApi.getPinnedNotes();
      if (data.success) {
        setPinnedNotes(data.notes);
      }
    } catch (err) {
      console.error("Failed to fetch pinned notes", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        setLoading(true);
        const { data } = await personalNoteApi.searchNotes(searchQuery);
        if (data.success) {
          setSearchResults(data.notes);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const displayNotes = searchQuery.trim() ? searchResults : pinnedNotes;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-5 shadow-sm flex flex-col h-full max-h-[600px]">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-5 w-5 text-indigo-500" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100">
          Personal Notes
        </h3>
      </div>

      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search personal notes..."
          className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-gray-600 rounded-lg bg-slate-50 dark:bg-gray-700/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-200"
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {!loading && displayNotes.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-gray-400 text-sm">
            {searchQuery.trim()
              ? "No notes found matching your search."
              : "No pinned notes yet. Pin notes in meetings to see them here."}
          </div>
        ) : (
          displayNotes.map((note) => (
            <Link
              key={note._id}
              to={`/meetings/${note.meetingId?._id}`}
              className="block p-3 rounded-lg border border-slate-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-500 hover:shadow-sm transition-all bg-slate-50/50 dark:bg-gray-700/30 group"
            >
              <div className="flex items-start justify-between mb-1">
                <h4 className="font-medium text-sm text-slate-800 dark:text-gray-200 truncate pr-2">
                  {note.meetingId?.title || "Untitled Meeting"}
                </h4>
                {note.isPinned && (
                  <Pin className="h-3 w-3 text-amber-500 flex-shrink-0 mt-1" />
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 line-clamp-2">
                {note.content || "No content"}
              </p>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                <span className="flex items-center text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </div>
            </Link>
          ))
        )}
        {loading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalNotesSidebar;
