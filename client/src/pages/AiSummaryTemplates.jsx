import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import { aiSummaryTemplateApi } from "../services";
import { toast } from "react-toastify";
import { FaTrash, FaEdit, FaStar, FaRegStar, FaPlay } from "react-icons/fa";

const AiSummaryTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    customInstructions: "",
    expectedFormat: "json",
    isDefault: false,
  });

  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await aiSummaryTemplateApi.getTemplates();
      setTemplates(res.data);
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await aiSummaryTemplateApi.updateTemplate(editingId, formData);
        toast.success("Template updated");
      } else {
        await aiSummaryTemplateApi.createTemplate(formData);
        toast.success("Template created");
      }
      setShowForm(false);
      resetForm();
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || "Error saving template");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: "",
      description: "",
      customInstructions: "",
      expectedFormat: "json",
      isDefault: false,
    });
    setTestResult(null);
  };

  const handleEdit = (template) => {
    setEditingId(template._id);
    setFormData({
      name: template.name,
      description: template.description || "",
      customInstructions: template.customInstructions || "",
      expectedFormat: template.expectedFormat || "json",
      isDefault: template.isDefault || false,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this template?"))
      return;
    try {
      await aiSummaryTemplateApi.deleteTemplate(id);
      toast.success("Template deleted");
      fetchTemplates();
    } catch {
      toast.error("Failed to delete template");
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await aiSummaryTemplateApi.setDefaultTemplate(id);
      toast.success("Default template updated");
      fetchTemplates();
    } catch {
      toast.error("Failed to set default");
    }
  };

  const handleTestPrompt = async () => {
    if (!formData.customInstructions) {
      toast.error("Please enter custom instructions to test");
      return;
    }

    try {
      setTesting(true);
      const res = await aiSummaryTemplateApi.testTemplate({
        customInstructions: formData.customInstructions,
      });
      setTestResult(res.data);
      toast.success("Test completed");
    } catch {
      toast.error("Test failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-slate-800 dark:text-slate-200">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              AI Summary Templates
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Define custom instructions for how the AI should format your
              meeting summaries.
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
            >
              + Create Template
            </button>
          )}
        </div>

        {showForm ? (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-semibold mb-4">
              {editingId ? "Edit Template" : "New Template"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Sales Call BANT Format"
                  className="w-full p-2 border rounded-lg bg-transparent border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Brief description of what this format is for"
                  className="w-full p-2 border rounded-lg bg-transparent border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Custom Instructions for AI
                </label>
                <textarea
                  name="customInstructions"
                  rows="5"
                  required
                  value={formData.customInstructions}
                  onChange={handleInputChange}
                  placeholder="e.g., Extract BANT (Budget, Authority, Need, Timeline) and summarize action items as a numbered list."
                  className="w-full p-2 border rounded-lg bg-transparent border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                ></textarea>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="isDefault"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isDefault" className="text-sm">
                  Set as organization default
                </label>
              </div>

              <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleTestPrompt}
                  disabled={testing}
                  className="flex items-center space-x-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-4 py-2 rounded-lg font-medium hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition"
                >
                  <FaPlay size={12} />
                  <span>{testing ? "Testing..." : "Test Prompt"}</span>
                </button>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition"
                  >
                    Save Template
                  </button>
                </div>
              </div>
            </form>

            {testResult && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-lg mb-2">Test Result:</h3>
                <pre className="text-xs overflow-auto max-h-64 p-2 bg-white dark:bg-gray-900 rounded">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="text-center py-12">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-xl shadow border border-gray-200 dark:border-gray-800">
            <h3 className="text-xl font-medium mb-2">No templates found</h3>
            <p className="text-gray-500 mb-4">
              Create your first AI summary template to standardize meeting
              minutes.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
            >
              Create Template
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => (
              <div
                key={tpl._id}
                className={`bg-white dark:bg-gray-900 p-5 rounded-xl shadow border ${tpl.isDefault ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200 dark:border-gray-800"}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3
                    className="font-semibold text-lg truncate flex-1 pr-2"
                    title={tpl.name}
                  >
                    {tpl.name}
                  </h3>
                  <button
                    onClick={() => handleSetDefault(tpl._id)}
                    className={`shrink-0 ${tpl.isDefault ? "text-blue-500" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"}`}
                    title={
                      tpl.isDefault ? "Default template" : "Set as default"
                    }
                  >
                    {tpl.isDefault ? <FaStar /> : <FaRegStar />}
                  </button>
                </div>

                {tpl.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {tpl.description}
                  </p>
                )}

                <div className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded mb-4 line-clamp-3 overflow-hidden text-gray-500 dark:text-gray-400">
                  {tpl.customInstructions}
                </div>

                <div className="flex justify-end space-x-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                  <button
                    onClick={() => handleEdit(tpl)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                    title="Edit"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(tpl._id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                    title="Delete"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiSummaryTemplates;
