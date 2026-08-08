import { useState } from "react";
import { toast } from "react-toastify";
import { meetingApi } from "../services";

/**
 * Sanitizes input text to prevent XSS payloads and script injection in exported document formats (#1305)
 */
export const sanitizeExportText = (text) => {
  if (typeof text !== "string") return "";
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "");
};

/**
 * Sanitizes filenames to prevent header injection or directory traversal in export downloads (#1305)
 */
export const sanitizeExportFilename = (filename) => {
  if (typeof filename !== "string") return "meeting_export";
  return filename
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/<script.*?>.*?<\/script>/gi, "")
    .trim();
};

const useExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const exportMeeting = async (meeting, format) => {
    if (isExporting || !meeting) return;

    try {
      setIsExporting(true);

      const sanitizedMeeting = {
        ...meeting,
        title: sanitizeExportText(meeting.title),
        notes: sanitizeExportText(meeting.notes),
        summary: sanitizeExportText(meeting.summary),
      };

      const response = await meetingApi.exportMeeting(
        sanitizedMeeting._id,
        format,
      );

      const blob = new Blob([response.data], {
        type: response.headers["content-type"],
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      let rawFilename = `${sanitizedMeeting.title || "meeting"}_mom.${format}`;
      const disposition = response.headers["content-disposition"];
      if (disposition && disposition.indexOf("filename=") !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          rawFilename = matches[1].replace(/['"]/g, "");
        }
      }

      const safeFilename = sanitizeExportFilename(rawFilename);

      a.download = safeFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Error exporting meeting to ${format}:`, err);
      toast.error(`Failed to export meeting to ${format}`);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportMeeting,
    isExporting,
    sanitizeExportText,
    sanitizeExportFilename,
  };
};

export default useExport;
