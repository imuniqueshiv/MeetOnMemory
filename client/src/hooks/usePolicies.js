import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { policyApi } from "../services";

export const usePolicies = () => {
  // Upload state
  const [file, setFile] = useState(null);
  const [commitMsg, setCommitMsg] = useState("");
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [existingPolicy, setExistingPolicy] = useState(null);
  const [uploadStage, setUploadStage] = useState("idle"); // idle | uploading | processing | done | error
  const [uploadProgress, setUploadProgress] = useState(0);

  // Data
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state for modals
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [showHistoryFor, setShowHistoryFor] = useState(null);
  const [comparePair, setComparePair] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // UI state for filters
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("desc");

  const isUploading =
    uploadStage === "uploading" || uploadStage === "processing";

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await policyApi.getPolicies();
      if (res.data.success) setPolicies(res.data.policies || []);
      else toast.error(res.data.message || "Failed to load policies.");
    } catch (err) {
      if (err.response) {
        toast.error(
          `Server error (${err.response.status}): Could not fetch policies.`,
        );
      } else if (err.request) {
        toast.error(
          "Network error: Unable to reach the server. Check your connection.",
        );
      } else {
        toast.error("Failed to load policies.");
      }
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // File selection (smart duplicate detection)
  const handleFileSelect = useCallback(
    (f) => {
      if (!f) return;
      setFile(f);
      setUploadProgress(0);
      setUploadStage("idle");

      const found = policies.find((p) => p.name === f.name);
      if (found) {
        setExistingPolicy(found);
        setShowUpdatePrompt(true);
      } else {
        setExistingPolicy(null);
        setShowUpdatePrompt(false);
      }
    },
    [policies],
  );

  const handleUpload = async (isUpdate = false) => {
    if (!file) return toast.error("Please select a file first.");
    if (isUploading) return;

    const formData = new FormData();
    formData.append("file", file);
    if (isUpdate && commitMsg.trim()) formData.append("commitMsg", commitMsg);

    setUploadStage("uploading");
    setUploadProgress(0);

    try {
      const res = await policyApi.uploadPolicy(formData, isUpdate, {
        onUploadProgress: (event) => {
          if (event.total) {
            const pct = Math.round((event.loaded * 100) / event.total);
            setUploadProgress(Math.min(pct, 85)); // cap at 85 — rest is AI processing
          }
        },
      });

      if (res.data.success) {
        setUploadStage("done");
        setUploadProgress(100);
        toast.success(
          isUpdate
            ? "✅ New version uploaded and analyzed successfully!"
            : "✅ Policy uploaded and analyzed successfully!",
        );

        setTimeout(() => {
          setFile(null);
          setCommitMsg("");
          setShowUpdatePrompt(false);
          setExistingPolicy(null);
          setUploadStage("idle");
          setUploadProgress(0);
          fetchPolicies();
        }, 1500);
      } else {
        setUploadStage("error");
        toast.error(res.data.message || "Upload failed. Please try again.");
        setTimeout(() => setUploadStage("idle"), 3000);
      }
    } catch (err) {
      setUploadStage("error");
      console.error("Upload error:", err);
      if (err.response) {
        const msg = err.response.data?.message;
        if (err.response.status === 401) {
          toast.error("Session expired. Please log in and try again.");
        } else if (err.response.status === 400) {
          toast.error(
            msg || "Invalid file. Please check the file type and size.",
          );
        } else if (err.response.status === 413) {
          toast.error("File too large. Maximum allowed size is 20 MB.");
        } else {
          toast.error(msg || "Server error during upload. Please try again.");
        }
      } else if (err.request) {
        toast.error("Network error: Upload could not reach the server.");
      } else {
        toast.error("Unexpected error. Please try again.");
      }
      setTimeout(() => setUploadStage("idle"), 3000);
    }
  };

  const handleDownload = async (policyId, filename = "policy.pdf") => {
    try {
      const res = await policyApi.downloadPolicy(policyId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error("File not found on the server.");
      } else {
        toast.error("Download failed. Please try again.");
      }
    }
  };

  const handleDelete = async (policyId) => {
    try {
      const res = await policyApi.deletePolicy(policyId);
      if (res.data.success) {
        toast.success("Policy deleted.");
        setConfirmDelete(null);
        if (selectedPolicy?._id === policyId) setSelectedPolicy(null);
        fetchPolicies();
      } else {
        toast.error(res.data.message || "Delete failed.");
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 404) {
        toast.error("Policy not found — it may have already been deleted.");
        setConfirmDelete(null);
        fetchPolicies();
      } else {
        toast.error("Delete failed. Please try again.");
      }
    }
  };

  const handleReanalyze = async (policyId) => {
    toast.info("🤖 Re-analyzing policy with AI…");
    try {
      const res = await policyApi.analyzePolicy(policyId);
      if (res.data.success) {
        toast.success("✅ AI analysis complete!");
        fetchPolicies();
      } else {
        toast.error(res.data.message || "AI processing failed.");
      }
    } catch (err) {
      console.error("Re-analyze error:", err);
      toast.error("AI processing failed. Please try again later.");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...policies];
    if (q) {
      list = list.filter((p) =>
        [p.name, p.summary, (p.keywords || []).join(" "), p?.uploadedBy?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey] || a.updatedAt || a.createdAt || "";
      const bv = b[sortKey] || b.updatedAt || b.createdAt || "";
      return av > bv ? dir : av < bv ? -dir : 0;
    });
    return list;
  }, [policies, query, sortKey, sortDir]);

  return {
    // Data
    policies,
    filtered,
    loading,
    fetchPolicies,
    // Upload state
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
    // Methods
    handleFileSelect,
    handleUpload,
    handleDownload,
    handleDelete,
    handleReanalyze,
    // Modal UI states
    selectedPolicy,
    setSelectedPolicy,
    showHistoryFor,
    setShowHistoryFor,
    comparePair,
    setComparePair,
    confirmDelete,
    setConfirmDelete,
    // Filters
    query,
    setQuery,
    sortKey,
    setSortKey,
    sortDir,
    setSortDir,
  };
};
