import React, { useState, useEffect, useContext } from "react";
import {
  Tag,
  Edit2,
  Trash2,
  Plus,
  X,
  ArrowLeft,
  Loader2,
  Search,
  GitMerge,
  Download,
  CheckSquare,
  Square,
  Layers,
  Check,
} from "lucide-react";
import { toast } from "react-toastify";
import { tagApi } from "../services";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent";
import { useNavigate } from "react-router-dom";

const TagBrowser = () => {
  const { userData } = useContext(AppContent);
  const navigate = useNavigate();
  const isAdmin = userData?.role === "admin" || userData?.role === "owner";

  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Drill-down state
  const [selectedTag, setSelectedTag] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState([]);

  // Create/Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    color: "#3B82F6",
    description: "",
  });

  // Merge Tags Modal state
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [isMerging, setIsMerging] = useState(false);

  // Bulk Retag Modal state
  const [isBulkRetagModalOpen, setIsBulkRetagModalOpen] = useState(false);
  const [bulkTagsToAdd, setBulkTagsToAdd] = useState("");
  const [bulkTagsToRemove, setBulkTagsToRemove] = useState("");
  const [isBulkRetagging, setIsBulkRetagging] = useState(false);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const res = await tagApi.getOrgTags();
      if (res.data?.success) {
        setTags(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load tags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleOpenModal = (tag = null) => {
    if (tag) {
      setEditingTag(tag);
      setFormData({
        name: tag.name,
        color: tag.color || "#3B82F6",
        description: tag.description || "",
      });
    } else {
      setEditingTag(null);
      setFormData({ name: "", color: "#3B82F6", description: "" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTag(null);
  };

  // Escape key handler for all modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isModalOpen) handleCloseModal();
        if (isMergeModalOpen) setIsMergeModalOpen(false);
        if (isBulkRetagModalOpen) setIsBulkRetagModalOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, isMergeModalOpen, isBulkRetagModalOpen]);

  const handleSaveTag = async (e) => {
    e.preventDefault();
    try {
      if (editingTag) {
        await tagApi.updateTag(editingTag._id, formData);
        toast.success("Tag updated successfully");
      } else {
        await tagApi.createTag(formData);
        toast.success("Tag created successfully");
      }
      handleCloseModal();
      fetchTags();
      if (selectedTag && selectedTag._id === editingTag?._id) {
        setSelectedTag({ ...selectedTag, ...formData });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save tag");
    }
  };

  const handleDeleteTag = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this tag? It will be removed from all associated meetings.",
      )
    )
      return;

    try {
      await tagApi.deleteTag(id);
      toast.success("Tag deleted successfully");
      fetchTags();
      if (selectedTag && selectedTag._id === id) {
        setSelectedTag(null);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete tag");
    }
  };

  const handleTagClick = async (tag) => {
    setSelectedTag(tag);
    setSelectedMeetingIds([]);
    try {
      setMeetingsLoading(true);
      const res = await tagApi.getMeetingsByTag(tag.name);
      if (res.data?.success) {
        setMeetings(res.data.data.meetings || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load meetings for this tag");
    } finally {
      setMeetingsLoading(false);
    }
  };

  // Export Stats Handler
  const handleExportTaxonomy = async () => {
    try {
      const response = await tagApi.exportTags();
      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "tags-taxonomy-export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Taxonomy stats exported successfully");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export taxonomy");
    }
  };

  // Merge Tags Handler
  const handleExecuteMerge = async (e) => {
    e.preventDefault();
    if (!mergeSourceId || !mergeTargetId) {
      toast.error("Please select both a source and target tag.");
      return;
    }
    if (mergeSourceId === mergeTargetId) {
      toast.error("Source and target tags must be different.");
      return;
    }

    try {
      setIsMerging(true);
      const { data } = await tagApi.mergeTags({
        sourceTagId: mergeSourceId,
        targetTagId: mergeTargetId,
      });
      toast.success(data?.message || "Tags merged successfully!");
      setIsMergeModalOpen(false);
      setMergeSourceId("");
      setMergeTargetId("");
      fetchTags();
      if (selectedTag && selectedTag._id === mergeSourceId) {
        setSelectedTag(null);
      }
    } catch (err) {
      console.error("Merge error:", err);
      toast.error(err.response?.data?.message || "Failed to merge tags");
    } finally {
      setIsMerging(false);
    }
  };

  // Bulk Retag Handler
  const handleExecuteBulkRetag = async (e) => {
    e.preventDefault();
    if (selectedMeetingIds.length === 0) {
      toast.error("No meetings selected for bulk retagging.");
      return;
    }

    const tagsToAdd = bulkTagsToAdd
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const tagsToRemove = bulkTagsToRemove
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (tagsToAdd.length === 0 && tagsToRemove.length === 0) {
      toast.error("Specify at least one tag to add or remove.");
      return;
    }

    try {
      setIsBulkRetagging(true);
      const { data } = await tagApi.bulkRetag({
        meetingIds: selectedMeetingIds,
        tagsToAdd,
        tagsToRemove,
      });
      toast.success(data?.message || "Meetings retagged successfully!");
      setIsBulkRetagModalOpen(false);
      setBulkTagsToAdd("");
      setBulkTagsToRemove("");
      setSelectedMeetingIds([]);
      fetchTags();
      if (selectedTag) {
        handleTagClick(selectedTag);
      }
    } catch (err) {
      console.error("Bulk retag error:", err);
      toast.error(
        err.response?.data?.message || "Failed to bulk retag meetings",
      );
    } finally {
      setIsBulkRetagging(false);
    }
  };

  const toggleSelectMeeting = (id) => {
    setSelectedMeetingIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id],
    );
  };

  const toggleSelectAllMeetings = () => {
    if (selectedMeetingIds.length === meetings.length) {
      setSelectedMeetingIds([]);
    } else {
      setSelectedMeetingIds(meetings.map((m) => m._id));
    }
  };

  const filteredTags = tags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tag.description &&
        tag.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar />
      <div className="flex-grow pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Tag className="w-8 h-8 text-blue-500" />
              Tag Management & Taxonomy
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Manage, merge, and audit your organization's meeting taxonomy
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportTaxonomy}
              className="px-3.5 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/80 flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer shadow-xs"
              title="Export tag taxonomy stats as CSV"
              aria-label="Export tag taxonomy stats"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Export CSV
            </button>

            {isAdmin && !selectedTag && (
              <>
                <button
                  onClick={() => {
                    setMergeSourceId("");
                    setMergeTargetId("");
                    setIsMergeModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer shadow-xs"
                  aria-label="Merge taxonomy tags"
                >
                  <GitMerge className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Merge Tags
                </button>

                <button
                  onClick={() => handleOpenModal()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-semibold transition-colors cursor-pointer shadow-sm"
                  aria-label="Create new tag"
                >
                  <Plus className="w-4 h-4" />
                  New Tag
                </button>
              </>
            )}
          </div>
        </div>

        {selectedTag ? (
          /* Drill-down View */
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <button
                onClick={() => {
                  setSelectedTag(null);
                  setSelectedMeetingIds([]);
                }}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to all tags
              </button>

              {isAdmin && meetings.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAllMeetings}
                    className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    {selectedMeetingIds.length === meetings.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {selectedMeetingIds.length === meetings.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>

                  <button
                    onClick={() => setIsBulkRetagModalOpen(true)}
                    disabled={selectedMeetingIds.length === 0}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed shadow-xs"
                    aria-label="Bulk retag selected meetings"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Bulk Retag ({selectedMeetingIds.length})
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100 dark:border-gray-700">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-sm"
                style={{ backgroundColor: selectedTag.color || "#3B82F6" }}
              >
                #
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedTag.name}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {selectedTag.description || "No description provided"}
                </p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Meetings with this tag ({meetings.length})
            </h3>

            {meetingsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No meetings found with this tag.
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map((m) => {
                  const isChecked = selectedMeetingIds.includes(m._id);
                  return (
                    <div
                      key={m._id}
                      className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                        isChecked
                          ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20"
                          : "border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 bg-gray-50/50 dark:bg-gray-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => toggleSelectMeeting(m._id)}
                            className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                            aria-label={`Select meeting ${m.title}`}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        )}
                        <div
                          onClick={() => navigate(`/meeting/${m._id}`)}
                          className="min-w-0 cursor-pointer"
                        >
                          <h4 className="font-semibold text-gray-900 dark:text-white truncate hover:text-blue-600">
                            {m.title}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {new Date(m.date).toLocaleDateString()} •{" "}
                            {m.uploadedBy?.name || "Organizer"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        {m.tags &&
                          m.tags.map((t, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-[11px] font-medium"
                            >
                              #{t}
                            </span>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Tag List/Cloud View */
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 flex items-center gap-3">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tags by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  Clear
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No tags found
                </p>
                <p className="text-sm">
                  {searchQuery
                    ? "No tags matching your search query."
                    : "Create your first tag to start organizing meetings."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                        Name
                      </th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                        Description
                      </th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                        Usage
                      </th>
                      {isAdmin && (
                        <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600 dark:text-gray-300">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredTags.map((tag) => (
                      <tr
                        key={tag._id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleTagClick(tag)}
                            className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left cursor-pointer"
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm"
                              style={{
                                backgroundColor: tag.color || "#3B82F6",
                              }}
                            >
                              #
                            </div>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {tag.name}
                            </span>
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                          {tag.description || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                          {tag.usageCount || 0} meetings
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenModal(tag);
                              }}
                              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              aria-label={`Edit tag ${tag.name}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTag(tag._id);
                              }}
                              className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                              aria-label={`Delete tag ${tag.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create / Edit Tag Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tag-modal-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3
                id="tag-modal-title"
                className="text-xl font-bold text-gray-900 dark:text-white"
              >
                {editingTag ? "Edit Tag" : "New Tag"}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTag} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tag Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  placeholder="e.g. Finance, Policy"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Color
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    className="w-12 h-12 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-sm text-gray-500 uppercase">
                    {formData.color}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  maxLength={200}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white resize-none"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-sm cursor-pointer"
                >
                  Save Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Tags Modal */}
      {isMergeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMergeModalOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Merge Taxonomy Tags Dialog"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-indigo-500" />
                Merge Taxonomy Tags
              </h3>
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                aria-label="Close merge dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleExecuteMerge} className="p-6 space-y-4">
              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800 text-xs text-indigo-800 dark:text-indigo-200 leading-relaxed">
                Merging replaces the <strong>Source Tag</strong> across all
                meetings with the <strong>Target Tag</strong> and deletes the
                source tag from your taxonomy.
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">
                  Source Tag (Will be removed) *
                </label>
                <select
                  data-testid="merge-source-select"
                  value={mergeSourceId}
                  onChange={(e) => setMergeSourceId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none"
                >
                  <option value="">Select source tag...</option>
                  {tags.map((t) => (
                    <option key={t._id} value={t._id}>
                      #{t.name} ({t.usageCount || 0} meetings)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">
                  Target Tag (Will be retained) *
                </label>
                <select
                  data-testid="merge-target-select"
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none"
                >
                  <option value="">Select target tag...</option>
                  {tags
                    .filter((t) => t._id !== mergeSourceId)
                    .map((t) => (
                      <option key={t._id} value={t._id}>
                        #{t.name} ({t.usageCount || 0} meetings)
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMergeModalOpen(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="confirm-merge-tags-button"
                  disabled={isMerging || !mergeSourceId || !mergeTargetId}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {isMerging ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Merging...
                    </>
                  ) : (
                    <>
                      <GitMerge className="w-3.5 h-3.5" />
                      Confirm Merge
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Retag Modal */}
      {isBulkRetagModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBulkRetagModalOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Bulk Retag Meetings Dialog"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-500" />
                Bulk Retag Meetings
              </h3>
              <button
                type="button"
                onClick={() => setIsBulkRetagModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                aria-label="Close bulk retag dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleExecuteBulkRetag} className="p-6 space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Applying updates across{" "}
                <span className="font-bold text-gray-800 dark:text-white">
                  {selectedMeetingIds.length}
                </span>{" "}
                selected meeting(s).
              </p>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">
                  Tags to Add (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q3, Engineering, HighPriority"
                  value={bulkTagsToAdd}
                  onChange={(e) => setBulkTagsToAdd(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">
                  Tags to Remove (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deprecated, ReviewNeeded"
                  value={bulkTagsToRemove}
                  onChange={(e) => setBulkTagsToRemove(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkRetagModalOpen(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="confirm-bulk-retag-button"
                  disabled={isBulkRetagging}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {isBulkRetagging ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Retagging...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Apply Bulk Retag
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagBrowser;
