import React, { useState, useEffect, useContext, useMemo } from "react";
import Navbar from "../components/Navbar.jsx";
import axios from "axios";
import { toast } from "react-toastify";
import { AppContent } from "../context/AppContext.jsx";
import {
  Upload,
  FileText,
  History,
  Download,
  Eye,
  GitBranch,
  MessageSquare,
  Loader2,
  Trash2,
  UserCircle,
  Search,
  Filter,
  RefreshCw,
  Columns2,
} from "lucide-react";

/**
 * Policies.jsx — GitHub‑style Versioned AI Policy Repository
 *
 * What’s new:
 * ✅ Smart version detection (existing name → offer update/new)
 * ✅ Commit message when updating
 * ✅ Post‑upload AI summary + keywords (Gemini) – backend hook
 * ✅ Version history viewer + side‑by‑side compare (placeholder UI)
 * ✅ Clean, professional GitHub‑style UI
 * ✅ Uploader / last editor name surfaced
 * ✅ Delete policy + view previous versions
 */

const formatDate = (d) => new Date(d).toLocaleString();

const Pill = ({ children, tone = "indigo" }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-${tone}-50 text-${tone}-700 border-${tone}-200`}
  >
    {children}
  </span>
);

const Empty = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-16">
    <Icon className="w-10 h-10 text-gray-400 mb-3" />
    <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
    {subtitle && <p className="text-gray-500 mt-1 max-w-md">{subtitle}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

const Policies = () => {
  const { backendUrl } = useContext(AppContent);

  // Upload / update
  const [file, setFile] = useState(null);
  const [commitMsg, setCommitMsg] = useState("");
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [existingPolicy, setExistingPolicy] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Data
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [showHistoryFor, setShowHistoryFor] = useState(null);
  const [comparePair, setComparePair] = useState(null); // {older, newer}
  const [confirmDelete, setConfirmDelete] = useState(null); // policy object
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${backendUrl}/api/policies`, {
        withCredentials: true,
      });
      if (res.data.success) setPolicies(res.data.policies || []);
      else toast.error(res.data.message || "Failed to load policies");
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("Unable to fetch policy repository.");
    } finally {
      setLoading(false);
    }
  };

  // Smart duplicate detection by filename
  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const found = policies.find((p) => p.name === f.name);
    if (found) {
      setExistingPolicy(found);
      setShowUpdatePrompt(true);
    } else {
      setExistingPolicy(null);
      setShowUpdatePrompt(false);
    }
  };

  const triggerAnalysis = async (policyId) => {
    // Kick off Gemini analysis on the backend. Non‑blocking; we just show a toast.
    try {
      await axios.post(
        `${backendUrl}/api/policies/${policyId}/analyze`,
        {},
        { withCredentials: true }
      );
    } catch (e) {
      // Don’t fail the flow if analysis endpoint isn’t present.
      console.warn("AI analysis trigger failed (non‑fatal).", e);
    }
  };

  const handleUpload = async (isUpdate = false) => {
    if (!file) return toast.error("Please select a file first.");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    if (isUpdate && commitMsg.trim()) formData.append("commitMsg", commitMsg);

    try {
      const res = await axios.post(
        `${backendUrl}/api/policies/upload${isUpdate ? "?update=true" : ""}`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (res.data.success) {
        const { policyId } = res.data;
        toast.success(
          isUpdate
            ? "✅ New version uploaded successfully!"
            : "✅ Policy uploaded successfully!"
        );
        setFile(null);
        setCommitMsg("");
        setShowUpdatePrompt(false);
        await fetchPolicies();
        if (policyId) {
          triggerAnalysis(policyId);
          toast.info("🤖 Generating AI summary & keywords…");
        }
      } else toast.error(res.data.message || "Upload failed");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Server error during upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (policyId, filename = "policy.pdf") => {
    try {
      const res = await axios.get(`${backendUrl}/api/policies/download/${policyId}`, {
        responseType: "blob",
        withCredentials: true,
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error("Failed to download file.");
    }
  };

  const handleDelete = async (policyId) => {
    try {
      await axios.delete(`${backendUrl}/api/policies/${policyId}`, {
        withCredentials: true,
      });
      toast.success("🗑️ Policy deleted");
      setConfirmDelete(null);
      fetchPolicies();
    } catch (e) {
      console.error(e);
      toast.error("Delete failed");
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
          .includes(q)
      );
    }
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey] || a.updatedAt || a.createdAt;
      const bv = b[sortKey] || b.updatedAt || b.createdAt;
      return av > bv ? dir : av < bv ? -dir : 0;
    });
    return list;
  }, [policies, query, sortKey, sortDir]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="max-w-7xl mx-auto pt-24 pb-16 px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-indigo-600" /> Policies Repository
            </h1>
            <p className="text-gray-600 mt-1">
              Upload, version, compare and track policy documents with AI summaries.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchPolicies}
              className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Upload card */}
        <div className="bg-white shadow-sm p-6 rounded-2xl mb-8 border border-gray-100">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" /> Upload New Policy Document
          </h2>

          <div className="flex flex-col md:flex-row items-center gap-4">
            <input
              type="file"
              onChange={handleFileChange}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
            />
            <button
              onClick={() => handleUpload(false)}
              disabled={uploading}
              className={`bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition ${
                uploading ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                </span>
              ) : (
                "Upload"
              )}
            </button>
          </div>

          {/* Duplicate → update prompt */}
          {showUpdatePrompt && existingPolicy && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
              <h3 className="font-semibold text-yellow-800 flex items-center gap-2 mb-2">
                <GitBranch className="w-4 h-4" /> This file already exists (v{existingPolicy.version || "1.0"}).
              </h3>
              <p className="text-sm text-yellow-700 mb-3">
                Upload as a <b>new version</b> with a commit message, or upload as a new file (rename first).
              </p>

              <input
                type="text"
                placeholder="Commit message (e.g., Updated Section 2: Staff Policy)"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
              />

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleUpload(true)}
                  className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition"
                >
                  Commit & Upload New Version
                </button>
                <button
                  onClick={() => {
                    setShowUpdatePrompt(false);
                    setExistingPolicy(null);
                    setFile(null);
                  }}
                  className="border border-gray-300 px-5 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm"
                placeholder="Search policies, keywords, authors…"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Sort by</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="updatedAt">Last updated</option>
              <option value="createdAt">Created</option>
              <option value="name">Name</option>
            </select>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>

        {/* List */}
        <div className="bg-white shadow-sm p-0 rounded-2xl border border-gray-100 overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs uppercase tracking-wider text-gray-500 bg-gray-50 border-b">
            <div className="col-span-5">Name</div>
            <div className="col-span-2">Version</div>
            <div className="col-span-3">Author</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {loading ? (
            <div className="p-10"><p className="text-gray-500">Loading policies…</p></div>
          ) : filtered.length === 0 ? (
            <Empty
              icon={FileText}
              title="No policy documents yet"
              subtitle="Upload your first policy to get AI summary, keywords, and version tracking."
              action={
                <label className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-700">
                  <Upload className="w-4 h-4" /> Upload
                  <input type="file" className="hidden" onChange={handleFileChange} />
                </label>
              }
            />
          ) : (
            <ul className="divide-y">
              {filtered.map((p) => (
                <li key={p._id} className="px-6 py-4 grid md:grid-cols-12 gap-4 items-start">
                  {/* Name & meta */}
                  <div className="md:col-span-5">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-indigo-600 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setSelectedPolicy(p)}
                            className="text-left font-medium text-gray-900 hover:text-indigo-700"
                          >
                            {p.name}
                          </button>
                          {p.isDraft && <Pill tone="amber">Draft</Pill>}
                          {p.analysis?.status === "processing" && <Pill tone="blue">Analyzing…</Pill>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Created {formatDate(p.createdAt)} · Updated {formatDate(p.updatedAt || p.createdAt)}
                        </div>
                        {p.keywords?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {p.keywords.slice(0, 6).map((tag, i) => (
                              <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">#{tag}</span>
                            ))}
                          </div>
                        )}
                        {p.summary && (
                          <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                            {p.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Version */}
                  <div className="md:col-span-2">
                    <div className="inline-flex items-center gap-2">
                      <Pill>{p.version || "1.0"}</Pill>
                      {p.previousVersions?.length > 0 && (
                        <button
                          className="text-xs text-indigo-600 hover:underline"
                          onClick={() => setShowHistoryFor(p)}
                        >
                          <History className="w-3.5 h-3.5 inline mr-1" /> {p.previousVersions.length} prev
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Author */}
                  <div className="md:col-span-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <UserCircle className="w-4 h-4 text-gray-400" />
                      <span>{p?.uploadedBy?.name || p?.lastEditedBy?.name || "Unknown"}</span>
                    </div>
                    {p?.lastEditedBy?.name && (
                      <div className="text-xs text-gray-500">Last edited by {p.lastEditedBy.name}</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="md:col-span-2 flex md:justify-end gap-2">
                    <button
                      onClick={() => setSelectedPolicy(p)}
                      className="text-gray-700 text-sm hover:text-blue-600 flex items-center gap-1"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" /> View
                    </button>
                    <button
                      onClick={() => handleDownload(p._id, p.name)}
                      className="text-gray-700 text-sm hover:text-indigo-600 flex items-center gap-1"
                      title="Download"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                    <button
                      onClick={() => setShowHistoryFor(p)}
                      className="text-gray-700 text-sm hover:text-purple-600 flex items-center gap-1"
                      title="History"
                    >
                      <History className="w-4 h-4" /> History
                    </button>
                    <button
                      onClick={() => setConfirmDelete(p)}
                      className="text-red-600 text-sm hover:text-red-700 flex items-center gap-1"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* View Modal */}
      {selectedPolicy && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 px-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-lg p-6 relative">
            <button
              onClick={() => setSelectedPolicy(null)}
              className="absolute top-3 right-4 text-gray-500 hover:text-gray-700 text-xl"
            >
              ✖
            </button>

            <h2 className="text-2xl font-semibold mb-2 text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> {selectedPolicy.name}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Version: {selectedPolicy.version || "1.0"} · Uploaded {formatDate(selectedPolicy.createdAt)}
            </p>

            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
              {selectedPolicy.summary ||
                "This document does not have a text preview. Download to view the full file."}
            </div>

            {selectedPolicy.key_changes?.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" /> Key changes
                </h4>
                <ul className="text-sm text-gray-700 list-disc ml-5">
                  {selectedPolicy.key_changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedPolicy.previousVersions?.length > 0 && (
              <div className="mt-6 text-left">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" /> Previous Versions
                </h4>
                <ul className="text-sm text-gray-600 list-disc ml-5">
                  {selectedPolicy.previousVersions.map((v, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span>
                        {v.name} (v{v.version || "1.0"}) – {new Date(v.createdAt).toLocaleDateString()} {v?.uploadedBy?.name ? `· by ${v.uploadedBy.name}` : ""}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs text-gray-700 hover:text-blue-600"
                          onClick={() => handleDownload(v._id, v.name)}
                        >
                          <Download className="w-3.5 h-3.5 inline mr-1" /> Download
                        </button>
                        <button
                          className="text-xs text-indigo-700 hover:underline"
                          onClick={() => setComparePair({ older: v, newer: selectedPolicy })}
                        >
                          Compare
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Drawer/Modal */}
      {showHistoryFor && (
        <div className="fixed inset-0 bg-black/30 flex justify-center items-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl p-6 relative">
            <button
              onClick={() => setShowHistoryFor(null)}
              className="absolute top-3 right-4 text-gray-500 hover:text-gray-700 text-xl"
            >
              ✖
            </button>
            <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-600" /> Version history – {showHistoryFor.name}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Current: v{showHistoryFor.version || "1.0"} · {formatDate(showHistoryFor.updatedAt || showHistoryFor.createdAt)}
            </p>

            {showHistoryFor.previousVersions?.length ? (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {showHistoryFor.previousVersions.map((v) => (
                  <div key={v._id || v.createdAt} className="border rounded-xl p-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">v{v.version || "1.0"}</span> · {formatDate(v.createdAt)} {v?.uploadedBy?.name ? `· by ${v.uploadedBy.name}` : ""}
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="text-xs text-indigo-700 hover:underline" onClick={() => setComparePair({ older: v, newer: showHistoryFor })}>Compare with current</button>
                        <button className="text-xs text-gray-700 hover:text-blue-600" onClick={() => handleDownload(v._id, v.name)}>
                          <Download className="w-3.5 h-3.5 inline mr-1" /> Download
                        </button>
                      </div>
                    </div>
                    {v.commitMsg && (
                      <p className="text-sm text-gray-600 mt-2">Commit: {v.commitMsg}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No previous versions found.</p>
            )}
          </div>
        </div>
      )}

      {/* Compare Modal – side‑by‑side placeholder */}
      {comparePair && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
          <div className="bg-white w-full max-w-6xl rounded-2xl shadow-xl p-6 relative">
            <button
              onClick={() => setComparePair(null)}
              className="absolute top-3 right-4 text-gray-500 hover:text-gray-700 text-xl"
            >
              ✖
            </button>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Columns2 className="w-5 h-5 text-indigo-600" /> Compare versions
              </h3>
              <div className="text-sm text-gray-600">
                Older: <Pill>{comparePair.older.version || "?"}</Pill> → Newer: <Pill>{comparePair.newer.version || "?"}</Pill>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              <div className="border rounded-xl p-4 bg-gray-50">
                <h4 className="font-medium mb-1">v{comparePair.older.version || "?"} – {comparePair.older.name}</h4>
                <p className="text-xs text-gray-500 mb-2">{formatDate(comparePair.older.createdAt)} {comparePair?.older?.uploadedBy?.name ? `· by ${comparePair.older.uploadedBy.name}` : ""}</p>
                <pre className="text-sm text-gray-800 whitespace-pre-wrap">{comparePair.older.summary || "(No summary available)"}</pre>
              </div>
              <div className="border rounded-xl p-4 bg-gray-50">
                <h4 className="font-medium mb-1">v{comparePair.newer.version || "?"} – {comparePair.newer.name}</h4>
                <p className="text-xs text-gray-500 mb-2">{formatDate(comparePair.newer.updatedAt || comparePair.newer.createdAt)} {comparePair?.newer?.uploadedBy?.name ? `· by ${comparePair.newer.uploadedBy.name}` : ""}</p>
                <pre className="text-sm text-gray-800 whitespace-pre-wrap">{comparePair.newer.summary || "(No summary available)"}</pre>
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-500">
              This is a visual placeholder. Hook up a backend diff endpoint like <code>/api/policies/compare?from=[olderId]&to=[newerId]</code> and render a structured diff here (e.g., unified/inline with highlights).
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-lg p-6 relative">
            <button
              onClick={() => setConfirmDelete(null)}
              className="absolute top-3 right-4 text-gray-500 hover:text-gray-700 text-xl"
            >
              ✖
            </button>
            <div className="flex items-center gap-3">
              <Trash2 className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold">Delete policy?</h3>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              You are about to permanently delete <b>{confirmDelete.name}</b>. This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete._id)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Policies;
