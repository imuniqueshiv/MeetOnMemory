import React, { useState, useEffect, useCallback } from "react";
import {
  fetchTerms,
  createTerm,
  deleteTerm,
  approveTerm,
  rejectTerm,
} from "../services/glossaryApi";
import ConfirmModal from "../components/ConfirmModal.jsx";

const Glossary = () => {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  // Pending moderation (#2245)
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);
  const [editTargetId, setEditTargetId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    term: "",
    definition: "",
    category: "",
  });
  const [approveLoadingId, setApproveLoadingId] = useState(null);

  const loadTerms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTerms({ search: searchTerm });
      const termsList = Array.isArray(data) ? data : data?.terms || [];
      setTerms(termsList);
    } catch (loadError) {
      console.error("Failed to load glossary terms:", loadError);
      setError("We couldn't load the glossary right now. Please try again.");
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
    } catch (submitError) {
      console.error("Failed to add term:", submitError);
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
    } catch (deleteError) {
      console.error("Failed to delete term:", deleteError);
      alert("Failed to delete term");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleApprove = async (id, edits = undefined) => {
    setApproveLoadingId(id);
    try {
      await approveTerm(id, edits);
      setEditTargetId(null);
      loadTerms();
    } catch (approveError) {
      console.error("Failed to approve term:", approveError);
      alert("Failed to approve term");
    } finally {
      setApproveLoadingId(null);
    }
  };

  const handleRejectConfirm = async (termId) => {
    if (!rejectReason.trim()) return;
    setRejectLoading(true);
    try {
      await rejectTerm(termId, rejectReason.trim());
      setRejectTargetId(null);
      setRejectReason("");
      loadTerms();
    } catch (rejectError) {
      console.error("Failed to reject term:", rejectError);
      alert("Failed to reject term");
    } finally {
      setRejectLoading(false);
    }
  };

  const startEditAndApprove = (term) => {
    setRejectTargetId(null);
    setRejectReason("");
    setEditTargetId(term._id);
    setEditDraft({
      term: term.term,
      definition: term.definition,
      category: term.category || "",
    });
  };

  const handleEditAndApprove = async (id) => {
    await handleApprove(id, {
      term: editDraft.term.trim(),
      definition: editDraft.definition.trim(),
      category: editDraft.category.trim() || undefined,
    });
  };

  const pendingTerms = terms.filter((t) => t.approvalStatus === "pending");
  const approvedTerms = terms.filter((t) => t.approvalStatus === "approved");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
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
          className="bg-gray-50 p-6 rounded-lg mb-8 shadow-sm border border-gray-200"
        >
          <h3
            id="add-term-title"
            className="text-lg font-medium text-gray-900 mb-4"
          >
            Add New Term
          </h3>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Term
                </label>
                <input
                  type="text"
                  required
                  value={newTerm.term}
                  onChange={(e) =>
                    setNewTerm({ ...newTerm, term: e.target.value })
                  }
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border"
                  placeholder="e.g. ROI"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Category
                </label>
                <input
                  type="text"
                  value={newTerm.category}
                  onChange={(e) =>
                    setNewTerm({ ...newTerm, category: e.target.value })
                  }
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border"
                  placeholder="e.g. Finance"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Definition
              </label>
              <textarea
                required
                value={newTerm.definition}
                onChange={(e) =>
                  setNewTerm({ ...newTerm, definition: e.target.value })
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border"
                rows={3}
                placeholder="Definition of the term"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Aliases (comma separated)
              </label>
              <input
                type="text"
                value={newTerm.aliases}
                onChange={(e) =>
                  setNewTerm({ ...newTerm, aliases: e.target.value })
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border"
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
          <h3 className="text-lg font-medium text-amber-600 mb-4 flex items-center">
            Pending AI Suggestions ({pendingTerms.length})
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingTerms.map((term) => (
              <div
                key={term._id}
                className="bg-white border-2 border-amber-200 rounded-lg shadow-sm p-4 relative"
              >
                <div className="absolute top-2 right-2 text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded">
                  AI Suggestion
                </div>
                {editTargetId === term._id ? (
                  <div className="mt-6 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Term
                      </label>
                      <input
                        type="text"
                        value={editDraft.term}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, term: e.target.value })
                        }
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Definition
                      </label>
                      <textarea
                        value={editDraft.definition}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            definition: e.target.value,
                          })
                        }
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border text-sm"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Category
                      </label>
                      <input
                        type="text"
                        value={editDraft.category}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            category: e.target.value,
                          })
                        }
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditAndApprove(term._id)}
                        disabled={
                          approveLoadingId === term._id ||
                          !editDraft.term.trim() ||
                          !editDraft.definition.trim()
                        }
                        className="flex-1 bg-green-600 text-white py-1 rounded text-sm hover:bg-green-700 cursor-pointer disabled:opacity-50"
                      >
                        {approveLoadingId === term._id
                          ? "Saving..."
                          : "Save & Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditTargetId(null)}
                        className="flex-1 bg-gray-100 text-gray-700 py-1 rounded text-sm hover:bg-gray-200 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : rejectTargetId === term._id ? (
                  <div className="mt-6 space-y-3">
                    <p className="text-sm text-gray-700">
                      Reject &quot;{term.term}&quot;?
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Reason for rejection
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border text-sm"
                        rows={3}
                        placeholder="e.g. Incorrect definition or duplicate concept"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleRejectConfirm(term._id)}
                        disabled={rejectLoading || !rejectReason.trim()}
                        className="flex-1 bg-red-600 text-white py-1 rounded text-sm hover:bg-red-700 cursor-pointer disabled:opacity-50"
                      >
                        {rejectLoading ? "Rejecting..." : "Confirm Reject"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectTargetId(null);
                          setRejectReason("");
                        }}
                        className="flex-1 bg-gray-100 text-gray-700 py-1 rounded text-sm hover:bg-gray-200 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h4 className="text-lg font-bold text-gray-900 mt-2">
                      {term.term}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {term.definition}
                    </p>
                    {term.category && (
                      <span className="inline-block mt-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {term.category}
                      </span>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(term._id)}
                        disabled={approveLoadingId === term._id}
                        className="flex-1 min-w-[5rem] bg-green-600 text-white py-1 rounded text-sm hover:bg-green-700 cursor-pointer disabled:opacity-50"
                      >
                        {approveLoadingId === term._id
                          ? "Approving..."
                          : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditAndApprove(term)}
                        className="flex-1 min-w-[5rem] bg-indigo-100 text-indigo-700 py-1 rounded text-sm hover:bg-indigo-200 cursor-pointer"
                      >
                        Edit & Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectTargetId(term._id);
                          setRejectReason("");
                          setEditTargetId(null);
                        }}
                        className="flex-1 min-w-[5rem] bg-red-100 text-red-700 py-1 rounded text-sm hover:bg-red-200 cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-lg font-medium text-gray-900">Approved Terms</h3>
          <div className="w-64">
            <input
              type="text"
              placeholder="Search terms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm p-2 border text-sm"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading terms...</p>
        ) : error ? (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-4"
          >
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={loadTerms}
              className="mt-3 inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : approvedTerms.length === 0 ? (
          <p className="text-gray-500">No approved terms found.</p>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {approvedTerms.map((term) => (
                <li key={term._id}>
                  <div className="px-4 py-4 sm:px-6 flex justify-between items-center">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 flex items-center">
                        {term.term}
                        {term.category && (
                          <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            {term.category}
                          </span>
                        )}
                      </h4>
                      <p className="mt-1 text-sm text-gray-600">
                        {term.definition}
                      </p>
                      {term.aliases && term.aliases.length > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                          Aliases: {term.aliases.join(", ")}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(term)}
                      className="text-red-500 hover:text-red-700 cursor-pointer"
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
  );
};

export default Glossary;
