import React, { useState, useEffect, useCallback } from "react";
import {
  Briefcase,
  Mail,
  ExternalLink,
  FileText,
  Clock,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  ChevronRight,
  User,
} from "lucide-react";
import {
  getCareerApplications,
  updateCareerApplicationStatus,
} from "../../services/careersApi";
import apiClient from "../../services/apiClient";

export default function CareersAdminQueue() {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [statusInput, setStatusInput] = useState("");

  const fetchApplicationsQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) {
        params.status = statusFilter;
      }
      const res = await getCareerApplications(params);
      if (res.data?.success) {
        setApplications(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch applications queue:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchApplicationsQueue();
  }, [fetchApplicationsQueue]);

  const handleStatusCommit = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;
    setSubmitting(true);

    try {
      const res = await updateCareerApplicationStatus(selectedApp._id, {
        status: statusInput,
        adminNotes: notes,
      });
      if (res.data?.success) {
        setSelectedApp(res.data.data);
        fetchApplicationsQueue();
      }
    } catch (err) {
      console.error("Failed processing status patch mutation:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadResume = async (appId, originalName) => {
    try {
      const response = await apiClient.get(
        `/api/careers/admin/applications/${appId}/resume`,
        {
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to download resume:", err);
      alert("Failed to download resume.");
    }
  };

  const selectApplicationForReview = (app) => {
    setSelectedApp(app);
    setStatusInput(app.status);
    setNotes(app.adminNotes || "");
  };

  const getStatusBadgeStyles = (status) => {
    switch (status) {
      case "accepted":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "rejected":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "interview_scheduled":
        return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
      case "reviewing":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "pending":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      default:
        return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Careers Application Queue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review incoming applications, update pipeline status, and log
            evaluation notes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Applications List */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold">Filter by Status:</span>
            </div>
            <select
              id="filterStatusSelect"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Applications</option>
              <option value="received">Received</option>
              <option value="pending">Pending</option>
              <option value="reviewing">Reviewing</option>
              <option value="interview_scheduled">Interview Scheduled</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl">
              <div className="w-8 h-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-4" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Hydrating candidates...
              </p>
            </div>
          ) : applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-center">
              <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No Applications Found
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mt-1">
                There are no job application submissions matching the selected
                status.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 text-xs font-bold uppercase tracking-wider">
                      <th className="p-4">Applicant</th>
                      <th className="p-4">Target Role</th>
                      <th className="p-4">Date Applied</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => (
                      <tr
                        key={app._id}
                        onClick={() => selectApplicationForReview(app)}
                        className={`border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${
                          selectedApp?._id === app._id
                            ? "bg-blue-50/20 dark:bg-blue-950/20"
                            : ""
                        }`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-semibold text-sm">
                              {app.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {app.name}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {app.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                            {app.jobTitle}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {new Date(app.createdAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </td>
                        <td className="p-4">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${getStatusBadgeStyles(
                              app.status,
                            )}`}
                          >
                            {app.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectApplicationForReview(app);
                            }}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Selected Worksheet Detail Drawer */}
        <div className="xl:col-span-1">
          {selectedApp ? (
            <aside className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Assessment Worksheet
                </h3>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${getStatusBadgeStyles(
                    selectedApp.status,
                  )}`}
                >
                  {selectedApp.status}
                </span>
              </div>

              {/* Candidate Info */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">
                    CANDIDATE
                  </label>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedApp.name}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="select-all">{selectedApp.email}</span>
                  </p>
                </div>

                <div>
                  <label className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">
                    TARGET ROLE
                  </label>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedApp.jobTitle}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ID: {selectedApp.jobId}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {selectedApp.resume && (
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadResume(
                          selectedApp._id,
                          selectedApp.resume.originalName,
                        )
                      }
                      className="flex items-center justify-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-blue-500" />
                      Download CV
                    </button>
                  )}
                  {selectedApp.portfolio && (
                    <a
                      href={selectedApp.portfolio}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors text-center"
                    >
                      <ExternalLink className="w-4 h-4 text-emerald-500" />
                      Portfolio
                    </a>
                  )}
                </div>

                {selectedApp.coverLetter && (
                  <div>
                    <label className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">
                      COVER LETTER
                    </label>
                    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-700 dark:text-slate-300 mt-1 max-h-36 overflow-y-auto whitespace-pre-line leading-relaxed">
                      {selectedApp.coverLetter}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Update Form */}
              <form
                onSubmit={handleStatusCommit}
                className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800"
              >
                <div className="space-y-1">
                  <label
                    htmlFor="statusInputSelect"
                    className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block"
                  >
                    TRANSITION STATUS
                  </label>
                  <select
                    id="statusInputSelect"
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-sm py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="received">Received</option>
                    <option value="pending">Pending</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="interview_scheduled">
                      Interview Scheduled
                    </option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="notesTextarea"
                    className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold block"
                  >
                    INTERNAL REVIEWER NOTES
                  </label>
                  <textarea
                    id="notesTextarea"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Record interview notes, technical evaluation scores..."
                    className="w-full h-24 bg-slate-50 dark:bg-slate-800 text-sm p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setSelectedApp(null)}
                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    {submitting ? "Saving..." : "Commit Assessment"}
                  </button>
                </div>
              </form>
            </aside>
          ) : (
            <div className="hidden xl:flex flex-col items-center justify-center p-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-400 dark:text-slate-600">
              <Eye className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-medium">Select an application</p>
              <p className="text-xs max-w-xs mt-0.5">
                Click any application row to open details, download resumes, and
                make status updates.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
