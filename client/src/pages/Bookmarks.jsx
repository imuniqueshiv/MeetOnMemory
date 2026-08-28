import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar.jsx";
import {
  getBookmarksAPI,
  getCollectionsAPI,
  deleteCollectionAPI,
  updateCollectionAPI,
  toggleBookmarkAPI,
  updateBookmarkAPI,
  shareCollectionAPI,
} from "../api/bookmarkApi.js";
import { useDebounce } from "../hooks/useDebounce.js";
import {
  FaBookmark,
  FaFolder,
  FaTrash,
  FaCalendarAlt,
  FaClock,
  FaBars,
  FaTimes,
  FaPlus,
  FaEdit,
  FaCheck,
  FaShareAlt,
  FaFileExport,
  FaSearch,
} from "react-icons/fa";

const PRESET_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#6b7280", // Gray
];

const Bookmarks = () => {
  const [collections, setCollections] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [activeCollection, setActiveCollection] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Collection Create / Edit Modal State
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [editingCollectionName, setEditingCollectionName] = useState(null); // null = create, string = rename
  const [colNameInput, setColNameInput] = useState("");
  const [colColorInput, setColColorInput] = useState("#3b82f6");

  // Bookmark Edit State
  const [editingBookmarkId, setEditingBookmarkId] = useState(null);
  const [bookmarkNotesInput, setBookmarkNotesInput] = useState("");
  const [bookmarkColorInput, setBookmarkColorInput] = useState("#3b82f6");

  // Search & Share
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareEmailsInput, setShareEmailsInput] = useState("");

  useEffect(() => {
    fetchCollections();
    fetchBookmarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCollection, debouncedSearchQuery]);

  // Close mobile drawer / modals when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isMobileDrawerOpen) setIsMobileDrawerOpen(false);
        if (isCollectionModalOpen) setIsCollectionModalOpen(false);
        if (editingBookmarkId) setEditingBookmarkId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileDrawerOpen, isCollectionModalOpen, editingBookmarkId]);

  const fetchCollections = async () => {
    try {
      const data = await getCollectionsAPI();
      setCollections(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load collections");
    }
  };

  const fetchBookmarks = async () => {
    try {
      setIsLoading(true);
      const data = await getBookmarksAPI(
        activeCollection,
        debouncedSearchQuery,
      );
      setBookmarks(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load bookmarks");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateCollection = () => {
    setEditingCollectionName(null);
    setColNameInput("");
    setColColorInput("#3b82f6");
    setIsCollectionModalOpen(true);
  };

  const handleOpenEditCollection = (col, e) => {
    e.stopPropagation();
    setEditingCollectionName(col.name);
    setColNameInput(col.name);
    setColColorInput(col.color || "#3b82f6");
    setIsCollectionModalOpen(true);
  };

  const handleSaveCollection = async (e) => {
    e.preventDefault();
    if (!colNameInput.trim()) {
      toast.warning("Collection name cannot be empty");
      return;
    }

    try {
      if (editingCollectionName) {
        // Update / Rename collection
        await updateCollectionAPI(editingCollectionName, {
          name: colNameInput.trim(),
          color: colColorInput,
        });
        toast.success("Collection updated successfully");
        if (activeCollection === editingCollectionName) {
          setActiveCollection(colNameInput.trim());
        }
      } else {
        toast.success(
          `Collection "${colNameInput.trim()}" ready for bookmarks`,
        );
        setActiveCollection(colNameInput.trim());
      }
      setIsCollectionModalOpen(false);
      fetchCollections();
      fetchBookmarks();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save collection");
    }
  };

  const handleDeleteCollection = async (name, e) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Are you sure you want to delete the collection "${name}"? This will remove all bookmarks in it.`,
      )
    )
      return;
    try {
      await deleteCollectionAPI(name);
      toast.success("Collection deleted");
      if (activeCollection === name) setActiveCollection(null);
      fetchCollections();
      fetchBookmarks();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete collection");
    }
  };

  const handleRemoveBookmark = async (meetingId, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await toggleBookmarkAPI(meetingId);
      toast.success("Bookmark removed");
      fetchCollections();
      fetchBookmarks();
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove bookmark");
    }
  };

  const handleStartEditBookmark = (bookmark, e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingBookmarkId(bookmark._id);
    setBookmarkNotesInput(bookmark.notes || "");
    setBookmarkColorInput(bookmark.color || "#3b82f6");
  };

  const handleSaveBookmarkEdit = async (bookmarkId, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await updateBookmarkAPI(bookmarkId, {
        notes: bookmarkNotesInput,
        color: bookmarkColorInput,
      });
      toast.success("Bookmark updated successfully");
      setEditingBookmarkId(null);
      fetchBookmarks();
      fetchCollections();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update bookmark");
    }
  };

  const handleExport = () => {
    if (bookmarks.length === 0) {
      toast.info("No bookmarks to export.");
      return;
    }
    const data = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeCollection || "all"}_bookmarks.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Collection exported");
  };

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!shareEmailsInput.trim()) return;
    const emails = shareEmailsInput
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    try {
      await shareCollectionAPI(activeCollection, emails);
      toast.success("Collection shared successfully");
      setIsShareModalOpen(false);
      setShareEmailsInput("");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to share collection",
      );
    }
  };

  const handleSelectCollection = (name) => {
    setActiveCollection(name);
    setIsMobileDrawerOpen(false);
  };

  const renderCollectionsList = () => (
    <>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <FaBookmark className="text-blue-500" />
          Collections
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenCreateCollection}
            aria-label="Add new collection"
            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer"
            title="Create Collection"
          >
            <FaPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMobileDrawerOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close collections drawer"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>
      </div>
      <ul className="p-2 space-y-1">
        <li>
          <button
            onClick={() => handleSelectCollection(null)}
            className={`w-full text-left px-3 py-2 rounded-md flex justify-between items-center transition-colors ${
              activeCollection === null
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <span>All Bookmarks</span>
          </button>
        </li>
        {collections.map((col) => (
          <li key={col.name}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleSelectCollection(col.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelectCollection(col.name);
                }
              }}
              className={`w-full text-left px-3 py-2 rounded-md flex justify-between items-center transition-colors group cursor-pointer ${
                activeCollection === col.name
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: col.color || "#3b82f6" }}
                ></div>
                <span className="truncate max-w-[130px]">{col.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">
                  {col.count}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleOpenEditCollection(col, e)}
                  aria-label={`Edit collection ${col.name}`}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-500 rounded transition-opacity cursor-pointer"
                  title="Edit collection"
                >
                  <FaEdit className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteCollection(col.name, e)}
                  aria-label={`Delete collection ${col.name}`}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-opacity cursor-pointer"
                  title="Delete collection"
                >
                  <FaTrash className="w-3 h-3" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex flex-col">
      <Navbar />

      <div className="flex-1 flex pt-16 relative overflow-hidden">
        {/* Mobile Drawer Overlay Backdrop */}
        {isMobileDrawerOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile Drawer (fixed on mobile) & Desktop Sidebar (static on md+) */}
        <aside
          id="bookmarks-sidebar"
          aria-label="Collections Sidebar"
          className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto transform transition-transform duration-200 ease-in-out pt-16 md:pt-0 ${
            isMobileDrawerOpen
              ? "translate-x-0 shadow-2xl md:shadow-none"
              : "-translate-x-full md:translate-x-0"
          }`}
        >
          {renderCollectionsList()}
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-w-0">
          <div className="mb-6 flex flex-col xl:flex-row xl:items-end justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
            <div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsMobileDrawerOpen(true)}
                  className="md:hidden inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-xs transition-colors"
                  aria-label="Open collections drawer"
                  aria-expanded={isMobileDrawerOpen}
                  aria-controls="bookmarks-sidebar"
                >
                  <FaBars className="w-4 h-4 text-blue-500" />
                  <span>Collections</span>
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  {activeCollection ? (
                    <>
                      <FaFolder className="text-blue-500 shrink-0" />
                      <span className="truncate">{activeCollection}</span>
                    </>
                  ) : (
                    "All Bookmarks"
                  )}
                </h1>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {bookmarks.length} saved meeting
                {bookmarks.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative w-full sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaSearch className="text-gray-400 w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  placeholder="Search bookmarks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {activeCollection && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsShareModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <FaShareAlt className="w-3.5 h-3.5" />
                    Share
                  </button>
                  <button
                    onClick={handleExport}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <FaFileExport className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <FaBookmark className="text-4xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">
                No bookmarks found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                {activeCollection
                  ? "This collection is empty."
                  : "You haven't bookmarked any meetings yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bookmarks.map((bookmark) => {
                const isOrphaned = !bookmark.meeting;
                const meetingId =
                  bookmark.rawMeetingId || bookmark.meeting?._id || null;
                const isEditing = editingBookmarkId === bookmark._id;

                const cardContent = (
                  <>
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10">
                      <button
                        onClick={(e) => handleStartEditBookmark(bookmark, e)}
                        className="text-gray-400 hover:text-blue-500 p-1 transition-colors cursor-pointer"
                        title="Edit Notes & Color"
                        aria-label="Edit bookmark notes"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={(e) => handleRemoveBookmark(meetingId, e)}
                        className="text-blue-500 hover:text-red-500 p-1 transition-colors cursor-pointer"
                        title="Remove bookmark"
                        aria-label="Remove bookmark"
                      >
                        <FaBookmark />
                      </button>
                    </div>
                    <div className="flex-1">
                      <h3
                        className={
                          "text-lg font-semibold text-gray-800 " +
                          "dark:text-white mb-2 pr-12 line-clamp-2"
                        }
                      >
                        {isOrphaned
                          ? "Meeting no longer available"
                          : bookmark.meeting.title}
                      </h3>
                      {!isOrphaned && (
                        <div
                          className={
                            "flex items-center gap-4 text-sm " +
                            "text-gray-500 dark:text-gray-400 mb-4"
                          }
                        >
                          <span className="flex items-center gap-1">
                            <FaCalendarAlt />
                            {new Date(
                              bookmark.meeting.date,
                            ).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <FaClock />
                            {bookmark.meeting.duration} min
                          </span>
                        </div>
                      )}

                      {isEditing ? (
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2"
                        >
                          <input
                            type="text"
                            data-testid="bookmark-notes-edit-input"
                            value={bookmarkNotesInput}
                            onChange={(e) =>
                              setBookmarkNotesInput(e.target.value)
                            }
                            placeholder="Add personal note..."
                            className="w-full text-xs px-2.5 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {PRESET_COLORS.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setBookmarkColorInput(c)}
                                  className={`w-3.5 h-3.5 rounded-full ${
                                    bookmarkColorInput === c
                                      ? "ring-2 ring-blue-500"
                                      : ""
                                  }`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                            <button
                              type="button"
                              data-testid="save-bookmark-edit-button"
                              onClick={(e) =>
                                handleSaveBookmarkEdit(bookmark._id, e)
                              }
                              className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <FaCheck className="w-2.5 h-2.5" /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        bookmark.notes && (
                          <div
                            className={
                              "bg-gray-50 dark:bg-gray-700/50 p-3 " +
                              "rounded-lg text-sm text-gray-700 " +
                              "dark:text-gray-300 italic mb-4 line-clamp-3"
                            }
                          >
                            "{bookmark.notes}"
                          </div>
                        )
                      )}
                    </div>
                    <div
                      className={
                        "mt-auto pt-4 border-t border-gray-100 " +
                        "dark:border-gray-700 flex justify-between " +
                        "items-center"
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: bookmark.color }}
                        ></div>
                        <span
                          className={
                            "text-xs font-medium text-gray-600 " +
                            "dark:text-gray-400"
                          }
                        >
                          {bookmark.collectionName}
                        </span>
                      </div>
                    </div>
                  </>
                );

                if (isOrphaned) {
                  return (
                    <div
                      key={bookmark._id}
                      className={
                        "bg-white dark:bg-gray-800 rounded-xl " +
                        "shadow-sm border border-gray-200 " +
                        "dark:border-gray-700 p-5 flex flex-col " +
                        "group relative opacity-75"
                      }
                    >
                      {cardContent}
                    </div>
                  );
                }

                return (
                  <div
                    key={bookmark._id}
                    className={
                      "bg-white dark:bg-gray-800 rounded-xl " +
                      "shadow-sm border border-gray-200 " +
                      "dark:border-gray-700 hover:shadow-md " +
                      "transition-shadow p-5 flex flex-col " +
                      "group relative"
                    }
                  >
                    {cardContent}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Collection Create/Edit Modal */}
      {isCollectionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Collection Settings Dialog"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {editingCollectionName
                ? "Rename Collection"
                : "Create New Collection"}
            </h3>
            <form onSubmit={handleSaveCollection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                  Collection Name
                </label>
                <input
                  type="text"
                  data-testid="collection-name-input"
                  value={colNameInput}
                  onChange={(e) => setColNameInput(e.target.value)}
                  placeholder="e.g. Leadership Strategy"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1.5">
                  Color Tag
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setColColorInput(color)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        colColorInput === color
                          ? "ring-2 ring-offset-2 ring-blue-500 scale-110"
                          : "opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCollectionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="save-collection-submit-button"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer"
                >
                  {editingCollectionName ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Collection Modal */}
      {isShareModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share Collection Dialog"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Share "{activeCollection}"
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Share all bookmarks in this collection with other users in your
              organization. They will receive independent copies.
            </p>
            <form onSubmit={handleShareSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 mb-1">
                  Email Addresses
                </label>
                <textarea
                  data-testid="share-emails-input"
                  value={shareEmailsInput}
                  onChange={(e) => setShareEmailsInput(e.target.value)}
                  placeholder="user1@test.com, user2@test.com"
                  rows={3}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsShareModalOpen(false);
                    setShareEmailsInput("");
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="share-collection-submit-button"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer"
                >
                  Share
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookmarks;
