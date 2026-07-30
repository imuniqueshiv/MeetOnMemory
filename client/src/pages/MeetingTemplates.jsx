import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import { meetingTemplateApi } from "../services";
import { toast } from "react-toastify";
import {
  FileText,
  Plus,
  Search,
  Clock,
  Tag,
  Trash2,
  Edit3,
  Eye,
  ArrowRight,
  Loader2,
  X,
  Layers,
  Users,
  CheckCircle2,
} from "lucide-react";

const CATEGORIES = [
  "General",
  "Engineering",
  "Product",
  "Sales",
  "HR",
  "Executive",
  "1-on-1",
];

const MeetingTemplates = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Modal States
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | 'preview' | 'delete'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    description: "",
    category: "General",
    defaultDuration: 30,
    agendaBlocks: [{ title: "", description: "", duration: 10 }],
    defaultParticipants: "",
  });

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await meetingTemplateApi.getTemplates();
      if (res.data?.success) {
        setTemplates(res.data.templates || []);
      }
    } catch (err) {
      console.error("Error loading meeting templates:", err);
      toast.error("Failed to load meeting templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const openCreateModal = () => {
    setFormData({
      name: "",
      title: "",
      description: "",
      category: "General",
      defaultDuration: 30,
      agendaBlocks: [
        { title: "Opening & Warmup", description: "", duration: 5 },
      ],
      defaultParticipants: "",
    });
    setModalMode("create");
  };

  const openEditModal = (template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name || template.title || "",
      title: template.title || "",
      description: template.description || "",
      category: template.category || "General",
      defaultDuration: template.defaultDuration || 30,
      agendaBlocks:
        template.agendaBlocks?.length > 0
          ? template.agendaBlocks.map((b) => ({ ...b }))
          : [{ title: "", description: "", duration: 10 }],
      defaultParticipants: Array.isArray(template.defaultParticipants)
        ? template.defaultParticipants.join(", ")
        : "",
    });
    setModalMode("edit");
  };

  const openPreviewModal = (template) => {
    setSelectedTemplate(template);
    setModalMode("preview");
  };

  const openDeleteModal = (template) => {
    setSelectedTemplate(template);
    setModalMode("delete");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedTemplate(null);
  };

  useEffect(() => {
    if (!modalMode) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalMode]);

  const handleAgendaChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.agendaBlocks];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, agendaBlocks: updated };
    });
  };

  const addAgendaBlock = () => {
    setFormData((prev) => ({
      ...prev,
      agendaBlocks: [
        ...prev.agendaBlocks,
        { title: "", description: "", duration: 10 },
      ],
    }));
  };

  const removeAgendaBlock = (index) => {
    setFormData((prev) => ({
      ...prev,
      agendaBlocks: prev.agendaBlocks.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.title) {
      toast.error("Template Name and Meeting Title are required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        defaultDuration: Number(formData.defaultDuration) || 30,
        agendaBlocks: formData.agendaBlocks.filter(
          (b) => b.title.trim() !== "",
        ),
        defaultParticipants: formData.defaultParticipants
          ? formData.defaultParticipants
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      };

      if (modalMode === "create") {
        const res = await meetingTemplateApi.createTemplate(payload);
        if (res.data?.success) {
          toast.success("Meeting template created!");
          await loadTemplates();
          closeModal();
        }
      } else if (modalMode === "edit" && selectedTemplate) {
        const res = await meetingTemplateApi.updateTemplate(
          selectedTemplate._id,
          payload,
        );
        if (res.data?.success) {
          toast.success("Meeting template updated!");
          await loadTemplates();
          closeModal();
        }
      }
    } catch (err) {
      console.error("Save template error:", err);
      toast.error(err.response?.data?.message || "Failed to save template.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    setSubmitting(true);
    try {
      const res = await meetingTemplateApi.deleteTemplate(selectedTemplate._id);
      if (res.data?.success) {
        toast.success("Template deleted.");
        setTemplates((prev) =>
          prev.filter((t) => t._id !== selectedTemplate._id),
        );
        closeModal();
      }
    } catch (err) {
      console.error("Delete template error:", err);
      toast.error(err.response?.data?.message || "Failed to delete template.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseTemplate = (template) => {
    navigate(`/create-meeting?templateId=${template._id}`);
  };

  const filteredTemplates = templates.filter((tpl) => {
    const matchesCategory =
      selectedCategory === "all" ||
      (tpl.category || "General").toLowerCase() ===
        selectedCategory.toLowerCase();

    const nameStr = (tpl.name || tpl.title || "").toLowerCase();
    const titleStr = (tpl.title || "").toLowerCase();
    const descStr = (tpl.description || "").toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch =
      !q || nameStr.includes(q) || titleStr.includes(q) || descStr.includes(q);

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 pt-20">
      <Navbar />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Meeting Templates
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Standardize recurring meetings, agendas, durations, and structures
              across your organization.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        </div>

        {/* Toolbar: Category Filters & Search */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  selectedCategory === "all"
                    ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                All Categories
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    selectedCategory.toLowerCase() === cat.toLowerCase()
                      ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Template Grid */}
        <div>
          {loading && (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-sm font-medium">Loading templates...</span>
            </div>
          )}

          {!loading && filteredTemplates.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                No meeting templates found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Get started by creating a new template for your recurring team
                meetings.
              </p>
              <button
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create First Template
              </button>
            </div>
          )}

          {!loading && filteredTemplates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTemplates.map((tpl) => (
                <div
                  key={tpl._id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
                        <Tag className="w-3 h-3" /> {tpl.category || "General"}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {tpl.defaultDuration || 30} mins
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {tpl.name || tpl.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Title: {tpl.title}
                      </p>
                    </div>

                    {tpl.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {tpl.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-blue-500" />
                        {(tpl.agendaBlocks || []).length} Agenda Blocks
                      </span>
                      {tpl.defaultParticipants?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-indigo-500" />
                          {tpl.defaultParticipants.length} Default Attendees
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openPreviewModal(tpl)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                        title="Preview Template"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(tpl)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                        title="Edit Template"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(tpl)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 cursor-pointer"
                        title="Delete Template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleUseTemplate(tpl)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer shadow-xs"
                    >
                      Use Template <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {(modalMode === "create" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="meeting-template-editor-title"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3
                id="meeting-template-editor-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                {modalMode === "create"
                  ? "Create Meeting Template"
                  : "Edit Meeting Template"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close template editor"
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Weekly Team Sync"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Default Meeting Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Weekly Team Alignment"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Default Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="480"
                    value={formData.defaultDuration}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        defaultDuration: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows="2"
                  placeholder="Overview or goals for meetings created with this template..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Participants (comma separated emails)
                </label>
                <input
                  type="text"
                  placeholder="alice@example.com, bob@example.com"
                  value={formData.defaultParticipants}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultParticipants: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Agenda Blocks Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" /> Agenda Items
                  </label>
                  <button
                    type="button"
                    onClick={addAgendaBlock}
                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Block
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {formData.agendaBlocks.map((block, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700"
                    >
                      <input
                        type="text"
                        placeholder="Block Title (e.g. Status Update)"
                        required
                        value={block.title}
                        onChange={(e) =>
                          handleAgendaChange(idx, "title", e.target.value)
                        }
                        className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Mins"
                        min="1"
                        value={block.duration}
                        onChange={(e) =>
                          handleAgendaChange(
                            idx,
                            "duration",
                            Number(e.target.value),
                          )
                        }
                        className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-center"
                      />
                      {formData.agendaBlocks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAgendaBlock(idx)}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {submitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {modalMode === "create" ? "Create Template" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {modalMode === "preview" && selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="meeting-template-preview-title"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  Template Preview
                </span>
                <h3
                  id="meeting-template-preview-title"
                  className="text-lg font-bold text-slate-900 dark:text-white"
                >
                  {selectedTemplate.name || selectedTemplate.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close template preview"
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-4 text-slate-500">
                <span>
                  Category:{" "}
                  <strong>{selectedTemplate.category || "General"}</strong>
                </span>
                <span>
                  Duration:{" "}
                  <strong>{selectedTemplate.defaultDuration || 30} mins</strong>
                </span>
              </div>

              {selectedTemplate.description && (
                <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 leading-relaxed">
                  {selectedTemplate.description}
                </p>
              )}

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-500" /> Agenda
                  Breakdown
                </h4>
                <div className="space-y-2">
                  {(selectedTemplate.agendaBlocks || []).map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800"
                    >
                      <span className="font-medium">{b.title}</span>
                      <span className="text-slate-500 font-semibold">
                        {b.duration} mins
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  closeModal();
                  handleUseTemplate(selectedTemplate);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer shadow-xs flex items-center gap-1"
              >
                Create Meeting with Template{" "}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {modalMode === "delete" && selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="meeting-template-delete-title"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
          >
            <h3
              id="meeting-template-delete-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              Delete Template?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete template "
              <strong>{selectedTemplate.name || selectedTemplate.title}</strong>
              "? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer flex items-center gap-1"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingTemplates;
