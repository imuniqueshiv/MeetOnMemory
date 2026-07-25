import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { meetingApi } from "../services";
import useExport from "./useExport";

export default function useMeetingSummary({
  userData,
  backendUrl,
  meetingId,
  transcript,
  title,
  meetingDate,
}) {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { exportMeeting, isExporting } = useExport();

  useEffect(() => {
    if (userData && backendUrl) {
      const socket = io(backendUrl, { withCredentials: true });
      socket.on("mom-generation-complete", (data) => {
        if (data && data.meetingId) {
          setSummary(
            data.summary || data.momText || JSON.stringify(data.mom || data),
          );
          toast.success("Minutes of Meeting created!");
          setIsSummarizing(false);
        }
      });
      return () => {
        socket.disconnect();
      };
    }
  }, [userData, backendUrl]);

  const handleGenerateSummary = async () => {
    if (!transcript && !meetingId) {
      toast.error("No transcript available. Upload a meeting first.");
      return;
    }
    if (!meetingDate) {
      toast.error("Please select a meeting date (required).");
      return;
    }

    try {
      setIsSummarizing(true);
      setSummary("");

      const payload = {
        meetingId: meetingId || undefined,
        transcript: meetingId ? undefined : transcript,
        date: meetingDate,
        title: title || undefined,
      };

      const res = await meetingApi.summarizeMeeting(payload);

      if (
        res.status === 202 ||
        (res.data?.success && res.data?.message?.includes("background"))
      ) {
        toast.info(
          "Minutes generation started in the background. Please wait...",
        );
      } else if (res.data?.success) {
        setSummary(
          res.data.momText ||
            res.data.summary ||
            JSON.stringify(res.data.mom || res.data),
        );
        toast.success("Minutes of Meeting created!");
        setIsSummarizing(false);
      } else {
        toast.error(res.data?.message || "Failed to generate summary");
        setIsSummarizing(false);
      }
    } catch (err) {
      console.error("Summarize error:", err);
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          err.message ||
          "AI summarization failed",
      );
      setIsSummarizing(false);
    }
  };

  const handleExport = (format) => {
    setShowExportMenu(false);
    const meetingToExport = {
      _id: meetingId,
      title: title,
      structuredMoM: summary,
    };
    exportMeeting(meetingToExport, format);
  };

  return {
    isSummarizing,
    summary,
    setSummary,
    showExportMenu,
    setShowExportMenu,
    isExporting,
    handleGenerateSummary,
    handleExport,
  };
}
