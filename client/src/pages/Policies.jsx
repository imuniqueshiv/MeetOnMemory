import React, { useContext, useRef, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent";
import { usePolicies } from "../hooks/usePolicies";
import { FileText, RefreshCw } from "lucide-react";
import PolicyFilters from "../components/policies/PolicyFilters";
import CreatePolicyModal from "../components/policies/CreatePolicyModal";
import PolicyTable from "../components/policies/PolicyTable";
import {
  PolicyDetailModal,
  HistoryModal,
  CompareModal,
  DeleteConfirmModal,
} from "../components/policies/PolicyDetailCard";
import { Modal } from "../components/policies/PolicyUtils";

const Policies = () => {
  const { userData } = useContext(AppContent);
  const isAdmin = userData?.role === "admin" || userData?.role === "owner";

  const {
    filtered,
    loading,
    fetchPolicies,
    file,
    setFile,
    commitMsg,
    setCommitMsg,
    showUpdatePrompt,
    setShowUpdatePrompt,
    existingPolicy,
    setExistingPolicy,
    uploadStage,
    setUploadStage,
    uploadProgress,
    isUploading,
    handleFileSelect,
    handleUpload,
    handleDownload,
    handleDelete,
    handleReanalyze,
    selectedPolicy,
    setSelectedPolicy,
    showHistoryFor,
    setShowHistoryFor,
    comparePair,
    setComparePair,
    confirmDelete,
    setConfirmDelete,
    query,
    setQuery,
    sortKey,
    setSortKey,
    sortDir,
    setSortDir,
  } = usePolicies();

  const uploadCardRef = useRef(null);

  const scrollToUpload = useCallback(() => {
    uploadCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    uploadCardRef.current?.querySelector("div[role='button']")?.focus();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar />

      <div className="max-w-7xl mx-auto w-full pt-24 pb-20 px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </span>
              Policy Repository
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
              Upload, version, and track policy documents with AI-powered
              summaries.
            </p>
          </div>

          <button
            onClick={fetchPolicies}
            className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium transition self-start md:self-auto"
            aria-label="Refresh policy list"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {isAdmin && (
          <CreatePolicyModal
            ref={uploadCardRef}
            onFileSelect={handleFileSelect}
            file={file}
            isUploading={isUploading}
            uploadStage={uploadStage}
            uploadProgress={uploadProgress}
            showUpdatePrompt={showUpdatePrompt}
            existingPolicy={existingPolicy}
            commitMsg={commitMsg}
            setCommitMsg={setCommitMsg}
            handleUpload={handleUpload}
            setShowUpdatePrompt={setShowUpdatePrompt}
            setExistingPolicy={setExistingPolicy}
            setFile={setFile}
            setUploadStage={setUploadStage}
          />
        )}

        <PolicyFilters
          query={query}
          setQuery={setQuery}
          sortKey={sortKey}
          setSortKey={setSortKey}
          sortDir={sortDir}
          setSortDir={setSortDir}
        />

        <PolicyTable
          filtered={filtered}
          loading={loading}
          query={query}
          isAdmin={isAdmin}
          scrollToUpload={scrollToUpload}
          setSelectedPolicy={setSelectedPolicy}
          setShowHistoryFor={setShowHistoryFor}
          handleDownload={handleDownload}
          setConfirmDelete={setConfirmDelete}
          handleReanalyze={handleReanalyze}
        />

        {!loading && filtered.length > 0 && (
          <p className="text-xs text-gray-400 mt-3 text-right">
            {filtered.length} {filtered.length === 1 ? "policy" : "policies"}{" "}
            {query ? "found" : "total"}
          </p>
        )}
      </div>

      {selectedPolicy && (
        <Modal onClose={() => setSelectedPolicy(null)} maxWidth="max-w-3xl">
          <PolicyDetailModal
            policy={selectedPolicy}
            onClose={() => setSelectedPolicy(null)}
            onDownload={handleDownload}
            onReanalyze={handleReanalyze}
            onCompare={(older) => {
              setComparePair({ older, newer: selectedPolicy });
              setSelectedPolicy(null);
            }}
          />
        </Modal>
      )}

      {showHistoryFor && (
        <Modal onClose={() => setShowHistoryFor(null)} maxWidth="max-w-4xl">
          <HistoryModal
            policy={showHistoryFor}
            onClose={() => setShowHistoryFor(null)}
            onDownload={handleDownload}
            onCompare={(older) => {
              setComparePair({ older, newer: showHistoryFor });
              setShowHistoryFor(null);
            }}
          />
        </Modal>
      )}

      {comparePair && (
        <Modal onClose={() => setComparePair(null)} maxWidth="max-w-6xl">
          <CompareModal
            pair={comparePair}
            onClose={() => setComparePair(null)}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} maxWidth="max-w-md">
          <DeleteConfirmModal
            policy={confirmDelete}
            onClose={() => setConfirmDelete(null)}
            onConfirm={() => handleDelete(confirmDelete._id)}
          />
        </Modal>
      )}
    </div>
  );
};

export default Policies;
