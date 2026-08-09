import React, { useState, useEffect, useRef, useCallback } from "react";
import { attachmentApi } from "../../services";
import { toast } from "react-toastify";
import {
  Paperclip,
  Upload,
  File,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
} from "lucide-react";

const AttachmentPanel = ({ meetingId }) => {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const fetchAttachments = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await attachmentApi.getAttachments(meetingId);
      if (data.success) {
        setAttachments(data.attachments);
      }
    } catch (error) {
      console.error("Error fetching attachments:", error);
      toast.error("Failed to load attachments");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleFileChange = async (e) => {
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
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(
          error.response?.data?.message || `Failed to upload ${files[i].name}`,
        );
      }
    }

    setUploading(false);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchAttachments();
  };

  const handleDownload = async (attachment) => {
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
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    }
  };

  const handleDelete = async (attachmentId) => {
    if (!window.confirm("Are you sure you want to delete this attachment?"))
      return;

    try {
      await attachmentApi.deleteAttachment(meetingId, attachmentId);
      toast.success("Attachment deleted");
      fetchAttachments();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(
        error.response?.data?.message || "Failed to delete attachment",
      );
    }
  };

  const getFileIcon = (mimeType) => {
    if (mimeType.includes("pdf"))
      return <FileText className="w-6 h-6 text-red-500 dark:text-red-400" />;
    if (mimeType.includes("image"))
      return <ImageIcon className="w-6 h-6 text-blue-500 dark:text-blue-400" />;
    if (mimeType.includes("word"))
      return <FileText className="w-6 h-6 text-blue-700 dark:text-blue-300" />;
    if (mimeType.includes("presentation"))
      return (
        <FileText className="w-6 h-6 text-orange-500 dark:text-orange-400" />
      );
    return <File className="w-6 h-6 text-gray-500 dark:text-slate-400" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Paperclip className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          Attachments
        </h2>
        <div>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,.gif"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-md transition-colors text-sm font-medium cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Upload File
          </button>
        </div>
      </div>

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
        <div className="text-center py-6 text-gray-500 dark:text-slate-400 text-sm animate-pulse">
          Loading attachments...
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-slate-950/50 rounded-lg border border-dashed border-gray-300 dark:border-slate-800">
          <Paperclip className="w-8 h-8 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">
            No attachments yet
          </p>
          <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">
            Upload PDF, DOCX, PPTX, or Images (Max 10MB)
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-slate-800 border border-gray-100 dark:border-slate-800 rounded-lg overflow-hidden">
          {attachments.map((file) => (
            <li
              key={file._id}
              className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {getFileIcon(file.mimeType)}
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate"
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
                  onClick={() => handleDownload(file)}
                  className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md transition-colors cursor-pointer"
                  title="Download"
                  aria-label="Download attachment"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(file._id)}
                  className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-md transition-colors cursor-pointer"
                  title="Delete"
                  aria-label="Delete attachment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AttachmentPanel;
