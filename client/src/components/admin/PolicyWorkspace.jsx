import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Search,
  Plus,
  Download,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileCheck,
  Upload,
} from "lucide-react";
import { toast } from "react-toastify";
import { policyApi } from "../../services";

const PolicyWorkspace = ({
  policies = [],
  loading = false,
  onRefresh,
  isAdmin = false,
}) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [actionPolicyId, setActionPolicyId] = useState(null);

  const categories = useMemo(() => {
    const set = new Set(policies.map((p) => p.category || "General"));
    return Array.from(set);
  }, [policies]);

  const filteredPolicies = useMemo(() => {
    return policies.filter((p) => {
      const title = (p.title || "").toLowerCase();
      const cat = (p.category || "general").toLowerCase();
      const matchesSearch = !search || title.includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || cat === categoryFilter.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [policies, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPolicies.length / pageSize));
  const paginatedPolicies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPolicies.slice(start, start + pageSize);
  }, [filteredPolicies, currentPage, pageSize]);

  const handleDownload = async (policyId, title) => {
    try {
      const res = await policyApi.downloadPolicy(policyId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${title || "policy"}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Policy document downloaded");
    } catch {
      toast.error("Failed to download policy");
    }
  };

  const handleDelete = async (policyId, title) => {
    if (!isAdmin) return;
    if (
      !window.confirm(
        `Are you sure you want to permanently delete "${title || "this policy"}"?`,
      )
    ) {
      return;
    }

    try {
      setActionPolicyId(policyId);
      await policyApi.deletePolicy(policyId);
      toast.success("Policy removed");
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete policy");
    } finally {
      setActionPolicyId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            Compliance & Policy Repository Workspace
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Maintain organizational policies, manage versions, and enforce
            compliance guidelines.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/policies")}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm transition"
        >
          <span>Full Policy Repository</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Controls Bar: Search & Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search policies by title or category..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>

        <div className="relative">
          <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
          Loading organizational policies...
        </div>
      ) : paginatedPolicies.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/40 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="py-3 px-4">Policy Document</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedPolicies.map((p) => {
                const pid = p._id || p.id;

                return (
                  <tr
                    key={pid}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
                          <FileCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                            {p.title || "Policy Document"}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">
                            {p.description || "Active compliance guideline"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {p.category || "General"}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                      v{p.version || "1.0"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">
                        {p.status || "Active"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownload(pid, p.title)}
                          title="Download Document"
                          className="p-1.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-950/30 transition"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(pid, p.title)}
                            disabled={actionPolicyId === pid}
                            title="Delete Policy"
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
          No policies matched your search criteria.
        </div>
      )}

      {/* Pagination Footer */}
      {filteredPolicies.length > pageSize && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, filteredPolicies.length)} of{" "}
            {filteredPolicies.length} policies
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-semibold">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyWorkspace;
