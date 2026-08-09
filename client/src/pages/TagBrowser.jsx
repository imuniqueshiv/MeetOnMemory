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

  // Drill-down state
  const [selectedTag, setSelectedTag] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    color: "#3B82F6",
    description: "",
  });

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

  // Escape dismisses the create/edit modal while it is open (#845)
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleCloseModal();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

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
      // If we are looking at this tag's meetings, update the selected tag
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar />
      <div className="flex-grow pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Tag className="w-8 h-8 text-blue-500" />
              Tag Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Manage your organization's taxonomy
            </p>
          </div>
          {isAdmin && !selectedTag && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Tag
            </button>
          )}
        </div>

        {selectedTag ? (
          /* Drill-down View */
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <button
              onClick={() => setSelectedTag(null)}
              className="mb-6 flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to all tags
            </button>

            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100 dark:border-gray-700">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                style={{ backgroundColor: selectedTag.color || "#3B82F6" }}
              >
                #
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedTag.name}
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  {selectedTag.description || "No description provided"}
                </p>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Meetings with this tag
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
              <div className="space-y-4">
                {meetings.map((m) => (
                  <div
                    key={m._id}
                    onClick={() => navigate(`/meeting/${m._id}`)}
                    className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer bg-gray-50/50 dark:bg-gray-800/50"
                  >
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {m.title}
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(m.date).toLocaleDateString()} •{" "}
                      {m.uploadedBy?.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Tag List/Cloud View */
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : tags.length === 0 ? (
              <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No tags found
                </p>
                <p>Create your first tag to start organizing meetings.</p>
              </div>
            ) : (
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
                  {tags.map((tag) => (
                    <tr
                      key={tag._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleTagClick(tag)}
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm"
                            style={{ backgroundColor: tag.color || "#3B82F6" }}
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
                        {tag.usageCount} meetings
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(tag);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTag(tag._id);
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseModal();
            }
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
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
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
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow-sm"
                >
                  Save Tag
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
