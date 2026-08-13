import React, { useState, useEffect, useCallback } from "react";
import {
  fetchTerms,
  createTerm,
  deleteTerm,
  approveTerm,
} from "../services/glossaryApi";
import ConfirmModal from "../components/ConfirmModal.jsx";

const Glossary = () => {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // New term form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTerm, setNewTerm] = useState({
    term: "",
    definition: "",
    aliases: "",
    category: "",
  });

  // Confirmation modal state (#1489)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadTerms = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTerms({ search: searchTerm });
      setTerms(data || []);
    } catch (error) {
      console.error("Failed to load glossary terms:", error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  // Keyboard Escape listener to close Add Term dialog (#1491)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && showAddForm) {
        setShowAddForm(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAddForm]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const aliasesArray = newTerm.aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      await createTerm({
        term: newTerm.term,
        definition: newTerm.definition,
        aliases: aliasesArray,
        category: newTerm.category,
      });
      setShowAddForm(false);
      setNewTerm({ term: "", definition: "", aliases: "", category: "" });
      loadTerms();
    } catch (error) {
      console.error("Failed to add term:", error);
      alert("Failed to add term");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteTerm(deleteTarget._id);
      setDeleteTarget(null);
      loadTerms();
    } catch (error) {
      console.error("Failed to delete term:", error);
      alert("Failed to delete term");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await approveTerm(id);
      loadTerms();
    } catch (error) {
      console.error("Failed to approve term:", error);
      alert("Failed to approve term");
    }
  };

  const pendingTerms = terms.filter((t) => t.approvalStatus === "pending");
  const approvedTerms = terms.filter((t) => t.approvalStatus === "approved");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:text-3xl sm:truncate">
              Organization Glossary
            </h2>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
            >
              {showAddForm ? "Cancel" : "Add Term"}
            </button>
          </div>
        </div>

        {showAddForm && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-term-title"
            className="bg-white dark:bg-gray-800 p-6 rounded-lg mb-8 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <h3
              id="add-term-title"
              className="text-lg font-medium text-gray-900 dark:text-white mb-4"
            >
              Add New Term
            </h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Term
                  </label>
                  <input
                    type="text"
                    required
                    value={newTerm.term}
                    onChange={(e) =>
                      setNewTerm({ ...newTerm, term: e.target.value })
                    }
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 border dark:bg-gray-700 dark:text-white"
                    placeholder="e.g. ROI"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newTerm.category}
                    onChange={(e) =>
                      setNewTerm({ ...newTerm, category: e.target.value })
                    }
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 border dark:bg-gray-700 dark:text-white"
                    placeholder="e.g. Finance"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Definition
                </label>
                <textarea
                  required
                  value={newTerm.definition}
                  onChange={(e) =>
                    setNewTerm({ ...newTerm, definition: e.target.value })
                  }
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 border dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="Definition of the term"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Aliases (comma separated)
                </label>
                <input
                  type="text"
                  value={newTerm.aliases}
                  onChange={(e) =>
                    setNewTerm({ ...newTerm, aliases: e.target.value })
                  }
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 border dark:bg-gray-700 dark:text-white"
                  placeholder="Return on Investment"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 cursor-pointer"
              >
                Save Term
              </button>
            </form>
          </div>
        )}

        {pendingTerms.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-medium text-amber-600 dark:text-amber-400 mb-4 flex items-center">
              Pending AI Suggestions ({pendingTerms.length})
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingTerms.map((term) => (
                <div
                  key={term._id}
                  className="bg-white dark:bg-gray-800 border-2 border-amber-200 dark:border-amber-900/50 rounded-lg shadow-sm p-4 relative"
                >
                  <div className="absolute top-2 right-2 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded">
                    AI Suggestion
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                    {term.term}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {term.definition}
                  </p>
                  {term.category && (
                    <span className="inline-block mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {term.category}
                    </span>
                  )}

                  <div className="mt-4 flex space-x-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(term._id)}
                      className="flex-1 bg-green-600 text-white py-1 rounded text-sm hover:bg-green-700 cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(term)}
                      className="flex-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 py-1 rounded text-sm hover:bg-red-200 dark:hover:bg-red-900/50 cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Approved Terms
            </h3>
            <div className="w-64">
              <input
                type="text"
                placeholder="Search terms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 border text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {loading ? (
            <p className="text-gray-500 dark:text-gray-400">Loading terms...</p>
          ) : approvedTerms.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              No approved terms found.
            </p>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border border-gray-200 dark:border-gray-700">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {approvedTerms.map((term) => (
                  <li key={term._id}>
                    <div className="px-4 py-4 sm:px-6 flex justify-between items-center">
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                          {term.term}
                          {term.category && (
                            <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300">
                              {term.category}
                            </span>
                          )}
                        </h4>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {term.definition}
                        </p>
                        {term.aliases && term.aliases.length > 0 && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Aliases: {term.aliases.join(", ")}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(term)}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Deletion Confirmation Modal (#1489) */}
        <ConfirmModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Glossary Term"
          message={`Are you sure you want to delete term "${deleteTarget?.term || "this term"}"? This action cannot be undone.`}
          confirmText="Delete Term"
          variant="danger"
          isLoading={deleteLoading}
        />
      </div>
    </div>
  );
};

export default Glossary;
