import React, { useState, useEffect, useRef, useCallback } from "react";
import { attachmentApi } from "../../services";
import { toast } from "react-toastify";
import { hasPermission } from "../../utils/rbacPermissions";
import {
  Paperclip,
  Upload,
  File,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  Eye,
  X,
  Loader2,
} from "lucide-react";

const CARD_CLASS =
  "bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 p-6 mb-6";

const getUploaderId = (uploadedBy) =>
  uploadedBy?._id || uploadedBy?.id || uploadedBy;

const AttachmentPanel = ({ meetingId, userRole, currentUserId }) => {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(Boolean(meetingId));
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef(null);

  const canUpload = hasPermission(userRole, "attachments", "upload");
  const canDownload = hasPermission(userRole, "attachments", "download");

  const canDeleteFile = (file) => {
    const uploaderId = getUploaderId(file.uploadedBy);
    const isUploader =
      Boolean(currentUserId) &&
      Boolean(uploaderId) &&
      String(uploaderId) === String(currentUserId);
    return isUploader || hasPermission(userRole, "attachments", "delete");
  };

  const fetchAttachments = useCallback(async () => {
    if (!meetingId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setForbidden(false);
      const { data } = await attachmentApi.getAttachments(meetingId);
      if (data.success) {
        setAttachments(data.attachments || []);
      } else {
        setAttachments([]);
        setError(data.message || "Failed to load attachments");
      }
    } catch (err) {
      console.error("Error fetching attachments:", err);
      const status = err.response?.status;
      const message =
        err.response?.data?.message || "Failed to load attachments";
      if (status === 401 || status === 403) {
        setForbidden(true);
        setError(
          message ||
            "You are not authorized to view attachments for this meeting.",
        );
      } else {
        setError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  const handleClosePreview = useCallback(() => {
    setPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return null;
    });
    setPreviewAttachment(null);
  }, []);

  const handleOpenPreview = useCallback(
    async (attachment) => {
      setPreviewAttachment(attachment);
      setPreviewLoading(true);

      setPreviewUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return null;
      });

      try {
        const response = await attachmentApi.previewAttachment(
          meetingId,
          attachment._id,
        );
        const blob = new Blob([response.data], {
          type: attachment.mimeType || "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch (error) {
        console.error("Preview error:", error);
        toast.error("Failed to load preview for this attachment");
      } finally {
        setPreviewLoading(false);
      }
    },
    [meetingId],
  );

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // Clean up object URLs on preview close or unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle escape key to close preview modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && previewAttachment) {
        handleClosePreview();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewAttachment, handleClosePreview]);

  const handleFileChange = async (e) => {
    if (!canUpload) return;

    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    if (files.length > 5) {
      toast.error("You can upload a maximum of 5 files at a time.");
      return;
    }

    const invalidSizeFiles = files.filter((f) => f.size > 10 * 1024 * 1024);
    if (invalidSizeFiles.length > 0) {
      toast.error("One or more files exceed the 10MB limit.");
      return;
    }

    setUploading(true);
    setProgress(0);

    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append("file", files[i]);

      try {
        await attachmentApi.uploadAttachment(
          meetingId,
          formData,
          (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            setProgress(percentCompleted);
          },
        );
        toast.success(`Uploaded ${files[i].name}`);
      } catch (err) {
        console.error("Upload error:", err);
        const status = err.response?.status;
        toast.error(
          err.response?.data?.message || `Failed to upload ${files[i].name}`,
        );
        if (status === 401 || status === 403) {
          setError(
            err.response?.data?.message ||
              "You are not authorized to upload attachments.",
          );
        }
      }
    }

    setUploading(false);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchAttachments();
  };

  const handleDownload = async (attachment) => {
    if (!canDownload) return;

    try {
      const response = await attachmentApi.downloadAttachment(
        meetingId,
        attachment._id,
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", attachment.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      toast.error(err.response?.data?.message || "Failed to download file");
    }
  };

  const handleDelete = async (attachmentId) => {
    if (!window.confirm("Are you sure you want to delete this attachment?"))
      return;

    try {
      await attachmentApi.deleteAttachment(meetingId, attachmentId);
      toast.success("Attachment deleted");
      if (previewAttachment && previewAttachment._id === attachmentId) {
        handleClosePreview();
      }
      fetchAttachments();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(err.response?.data?.message || "Failed to delete attachment");
    }
  };

  const getFileIcon = (mimeType) => {
    const type = mimeType || "";
    if (type.includes("pdf"))
      return <FileText className="w-6 h-6 text-red-500 dark:text-red-400" />;
    if (type.includes("image"))
      return <ImageIcon className="w-6 h-6 text-blue-500 dark:text-blue-400" />;
    if (type.includes("word"))
      return <FileText className="w-6 h-6 text-blue-700 dark:text-blue-300" />;
    if (type.includes("presentation"))
      return (
        <FileText className="w-6 h-6 text-orange-500 dark:text-orange-400" />
      );
    return <File className="w-6 h-6 text-gray-500 dark:text-slate-400" />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const isImageFile = (mimeType = "") => mimeType.startsWith("image/");
  const isPdfFile = (mimeType = "") => mimeType === "application/pdf";

  if (forbidden) {
    return (
      <div
        data-testid="attachment-panel-forbidden"
        data-meeting-id={meetingId}
        className={CARD_CLASS}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
          <Paperclip className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          Attachments
        </h2>
        <p role="status" className="text-sm text-gray-600 dark:text-slate-400">
          {error ||
            "You are not authorized to view attachments for this meeting."}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="attachment-panel"
      data-meeting-id={meetingId}
      className={CARD_CLASS}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Paperclip className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          Attachments
        </h2>
        {canUpload && (
          <div>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,.gif"
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Upload file"
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-md transition-colors text-sm font-medium cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              Upload File
            </button>
          </div>
        )}
      </div>

      {error && !loading && (
        <div
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchAttachments}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline self-start"
          >
            Retry
          </button>
        </div>
      )}

      {uploading && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1">
            <span>Uploading...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-2">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {loading ? (
        <div
          role="status"
          aria-label="Loading attachments"
          aria-busy="true"
          className="text-center py-6 text-gray-500 dark:text-slate-400 text-sm animate-pulse"
        >
          Loading attachments...
        </div>
      ) : attachments.length === 0 && !error ? (
        <div
          data-testid="attachment-panel-empty"
          className="text-center py-8 bg-gray-50 dark:bg-slate-950/50 rounded-lg border border-dashed border-gray-300 dark:border-slate-800"
        >
          <Paperclip className="w-8 h-8 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">
            No attachments yet
          </p>
          <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">
            {canUpload
              ? "Upload PDF, DOCX, PPTX, or Images (Max 10MB)"
              : "No files have been attached to this meeting."}
          </p>
        </div>
      ) : attachments.length === 0 ? null : (
        <ul className="divide-y divide-gray-100 dark:divide-slate-800 border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden">
          {attachments.map((file) => (
            <li
              key={file._id}
              className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div
                className="flex items-center gap-3 overflow-hidden cursor-pointer"
                onClick={() => handleOpenPreview(file)}
              >
                {getFileIcon(file.mimeType)}
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate hover:text-blue-600 dark:hover:text-blue-400"
                    title={file.fileName}
                  >
                    {file.fileName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-2">
                    <span>{formatFileSize(file.fileSize)}</span>
                    <span>•</span>
                    <span>{file.uploadedBy?.name || "Unknown"}</span>
                    <span>•</span>
                    <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <button
                  type="button"
                  onClick={() => handleOpenPreview(file)}
                  className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-md transition-colors cursor-pointer"
                  title="Preview"
                  aria-label={`Preview attachment ${file.fileName}`}
                >
                  <Eye className="w-4 h-4" />
                </button>
                {canDownload && (
                  <button
                    type="button"
                    onClick={() => handleDownload(file)}
                    className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md transition-colors cursor-pointer"
                    title="Download"
                    aria-label={`Download attachment ${file.fileName}`}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                {canDeleteFile(file) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(file._id)}
                    className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-md transition-colors cursor-pointer"
                    title="Delete"
                    aria-label={`Delete attachment ${file.fileName}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Inline Preview Modal Dialog */}
      {previewAttachment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Attachment Preview Dialog"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClosePreview();
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                {getFileIcon(previewAttachment.mimeType)}
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                    {previewAttachment.fileName}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {formatFileSize(previewAttachment.fileSize)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canDownload && (
                  <button
                    type="button"
                    onClick={() => handleDownload(previewAttachment)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50 dark:bg-slate-950 min-h-[300px]">
              {previewLoading ? (
                <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-sm">Loading preview...</span>
                </div>
              ) : isImageFile(previewAttachment.mimeType) && previewUrl ? (
                <img
                  src={previewUrl}
                  alt={previewAttachment.fileName}
                  className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm"
                />
              ) : isPdfFile(previewAttachment.mimeType) && previewUrl ? (
                <iframe
                  src={previewUrl}
                  title={`Preview of ${previewAttachment.fileName}`}
                  className="w-full h-[70vh] rounded-lg border border-gray-200 dark:border-slate-800"
                />
              ) : (
                <div className="text-center py-12 space-y-4 max-w-md">
                  <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    {getFileIcon(previewAttachment.mimeType)}
                  </div>
                  <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                    Preview not directly available for this format
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    You can download{" "}
                    <span className="font-semibold text-gray-700 dark:text-slate-300">
                      {previewAttachment.fileName}
                    </span>{" "}
                    to view it in your default application.
                  </p>
                  {canDownload && (
                    <button
                      type="button"
                      onClick={() => handleDownload(previewAttachment)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md"
                    >
                      <Download className="w-4 h-4" /> Download File
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttachmentPanel;
