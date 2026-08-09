import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar.jsx";
import {
  browseTemplates,
  cloneTemplate,
  rateTemplate,
} from "../services/templateLibraryApi";
import { CopyPlus, Star, ChevronDown, Filter } from "lucide-react";

const TemplateLibrary = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortOption, setSortOption] = useState("newest");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [ratingInput, setRatingInput] = useState(5);
  const [reviewInput, setReviewInput] = useState("");

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await browseTemplates({
        category: categoryFilter,
        sort: sortOption,
      });
      setTemplates(data.templates || []);
    } catch (err) {
      setError("Failed to load templates");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, sortOption]);

  const handleClone = async (templateId) => {
    try {
      await cloneTemplate(templateId);
      alert("Template cloned successfully!");
      fetchTemplates(); // Refresh to update clone count
    } catch {
      alert("Failed to clone template");
    }
  };

  const handleRate = async (templateId) => {
    try {
      await rateTemplate(templateId, {
        rating: ratingInput,
        review: reviewInput,
      });
      alert("Rating submitted successfully!");
      setRatingInput(5);
      setReviewInput("");
      fetchTemplates(); // Refresh to update rating
      setSelectedTemplate(null); // Close modal
    } catch {
      alert("Failed to submit rating");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto pt-24 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Template Library
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Browse and clone meeting templates published by your organization.
            </p>
          </div>
          <div className="flex gap-4 mt-4 md:mt-0">
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow px-3 py-2 border border-gray-200 dark:border-gray-700">
              <Filter className="w-4 h-4 text-gray-500 mr-2" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm text-gray-700 dark:text-gray-300"
              >
                <option value="">All Categories</option>
                <option value="General">General</option>
                <option value="Engineering">Engineering</option>
                <option value="HR">HR</option>
                <option value="Sales">Sales</option>
              </select>
            </div>
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg shadow px-3 py-2 border border-gray-200 dark:border-gray-700">
              <ChevronDown className="w-4 h-4 text-gray-500 mr-2" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm text-gray-700 dark:text-gray-300"
              >
                <option value="newest">Newest</option>
                <option value="popular">Most Popular</option>
                <option value="highestRated">Highest Rated</option>
              </select>
            </div>
          </div>
        </div>

        {error && <div className="text-red-500 mb-4">{error}</div>}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template._id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition cursor-pointer"
                onClick={() => setSelectedTemplate(template)}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {template.name}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {template.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
                    {template.description || "No description provided."}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <CopyPlus className="w-4 h-4 mr-1" />
                      <span>{template.cloneCount} clones</span>
                    </div>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 mr-1 text-yellow-400" />
                      <span>{template.averageRating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {templates.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No templates found.
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {selectedTemplate.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {selectedTemplate.description}
            </p>
            <div className="mb-6">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Agenda Blocks
              </h4>
              <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400">
                {selectedTemplate.agendaBlocks?.map((block, idx) => (
                  <li key={idx}>
                    {block.title} ({block.duration} min)
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-4 mb-6">
              <button
                onClick={() => handleClone(selectedTemplate._id)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition flex items-center justify-center"
              >
                <CopyPlus className="w-5 h-5 mr-2" />
                Clone Template
              </button>
            </div>

            <hr className="border-gray-200 dark:border-gray-700 my-4" />

            <div>
              <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Rate this template
              </h4>
              <div className="flex items-center mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-6 h-6 cursor-pointer ${
                      ratingInput >= star
                        ? "text-yellow-400 fill-current"
                        : "text-gray-300"
                    }`}
                    onClick={() => setRatingInput(star)}
                  />
                ))}
              </div>
              <textarea
                value={reviewInput}
                onChange={(e) => setReviewInput(e.target.value)}
                placeholder="Leave a review..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm mb-2 dark:bg-gray-700 dark:text-white"
                rows="3"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRate(selectedTemplate._id)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                >
                  Submit Rating
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateLibrary;
