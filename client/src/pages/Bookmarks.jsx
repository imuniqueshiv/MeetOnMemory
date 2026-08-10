import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import {
  getBookmarksAPI,
  getCollectionsAPI,
  deleteCollectionAPI,
  toggleBookmarkAPI,
} from "../api/bookmarkApi";
import {
  FaBookmark,
  FaFolder,
  FaTrash,
  FaCalendarAlt,
  FaClock,
} from "react-icons/fa";

const Bookmarks = () => {
  const [collections, setCollections] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [activeCollection, setActiveCollection] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCollections();
    fetchBookmarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCollection]);

  const fetchCollections = async () => {
    try {
      const data = await getCollectionsAPI();
      setCollections(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load collections");
    }
  };

  const fetchBookmarks = async () => {
    try {
      setIsLoading(true);
      const data = await getBookmarksAPI(activeCollection);
      setBookmarks(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load bookmarks");
    } finally {
      setIsLoading(false);
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

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="flex flex-1 overflow-hidden pt-16">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <FaBookmark className="text-blue-500" />
              Collections
            </h2>
          </div>
          <ul className="p-2 space-y-1">
            <li>
              <button
                onClick={() => setActiveCollection(null)}
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
                <button
                  onClick={() => setActiveCollection(col.name)}
                  className={`w-full text-left px-3 py-2 rounded-md flex justify-between items-center transition-colors group ${
                    activeCollection === col.name
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: col.color }}
                    ></div>
                    <span className="truncate max-w-[120px]">{col.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      {col.count}
                    </span>
                    <FaTrash
                      className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDeleteCollection(col.name, e)}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                {activeCollection ? (
                  <>
                    <FaFolder className="text-blue-500" />
                    {activeCollection}
                  </>
                ) : (
                  "All Bookmarks"
                )}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {bookmarks.length} saved meeting
                {bookmarks.length !== 1 ? "s" : ""}
              </p>
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

                const cardContent = (
                  <>
                    <button
                      onClick={(e) => handleRemoveBookmark(meetingId, e)}
                      className="absolute top-4 right-4 text-blue-500 hover:text-red-500 transition-colors z-10"
                      title="Remove bookmark"
                    >
                      <FaBookmark />
                    </button>
                    <div className="flex-1">
                      <h3
                        className={
                          "text-lg font-semibold text-gray-800 " +
                          "dark:text-white mb-2 pr-6 line-clamp-2"
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
                      {bookmark.notes && (
                        <div
                          className={
                            "bg-gray-50 dark:bg-gray-700/50 p-3 " +
                            "rounded-lg text-sm text-gray-700 " +
                            "dark:text-gray-300 italic mb-4 line-clamp-3"
                          }
                        >
                          "{bookmark.notes}"
                        </div>
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
                  <Link
                    to={`/meeting/${bookmark.meeting._id}`}
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
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Bookmarks;
