import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Mail, Eye, X, Loader2 } from "lucide-react";

const DigestActions = ({ meetingId }) => {
  const [loading, setLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleResend = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `/api/meetings/${meetingId}/digest/resend`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (data.success) {
        toast.success(data.message || "Email digest resent successfully");
      } else {
        toast.error(data.message || "Failed to resend email digest");
      }
    } catch (err) {
      console.error("Error resending digest:", err);
      toast.error(
        err.response?.data?.message || "Failed to resend email digest",
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      setModalOpen(true);
      const token = localStorage.getItem("token");
      const { data } = await axios.get(
        `/api/meetings/${meetingId}/digest/preview`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setPreviewHtml(data);
    } catch (err) {
      console.error("Error fetching preview:", err);
      toast.error("Failed to load digest preview");
      setModalOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          disabled={previewLoading || loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-blue-400"
          title="Preview Email Digest"
        >
          {previewLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
          Preview Digest
        </button>
        <button
          onClick={handleResend}
          disabled={loading || previewLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-blue-400"
          title="Resend Email Digest"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          Resend Digest
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                Email Digest Preview
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50 dark:bg-slate-950">
              {previewLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : previewHtml ? (
                <div
                  className="bg-white mx-auto shadow-sm border border-slate-200 rounded-lg overflow-hidden"
                  style={{ maxWidth: "600px" }}
                >
                  <iframe
                    title="Email Preview"
                    srcDoc={previewHtml}
                    className="w-full min-h-[500px]"
                    style={{ border: "none" }}
                  />
                </div>
              ) : (
                <div className="text-center text-slate-500 py-12">
                  Preview not available.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DigestActions;
