// client/src/pages/UploadMeeting.jsx
import React, { useState, useContext } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar.jsx";
import { AppContent } from "../context/AppContext.jsx";

const UploadMeeting = () => {
  const { backendUrl, userData } = useContext(AppContent);

  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [meetingId, setMeetingId] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const allowedTypes = [
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/x-m4a",
    "audio/mp4",
    "audio/m4a",
  ];

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!allowedTypes.includes(f.type)) {
      toast.error("Unsupported file type. Please use WAV, MP3, or M4A files.");
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select an audio file first.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setTranscript("");
      setSummary("");
      setMeetingId(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", `${userData?.name || "user"} - ${file.name}`);

      const res = await axios.post(`${backendUrl}/api/meetings/upload`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        },
      });

      if (res.data?.success) {
        toast.success("Transcription complete!");
        setTranscript(res.data.transcript || "");
        setMeetingId(res.data.meetingId || null);
      } else {
        toast.error(res.data?.message || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.response?.data?.message || err.message || "Server error during upload");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleGenerateSummary = async () => {
    if (!transcript && !meetingId) {
      toast.error("No transcript available. Upload a meeting first.");
      return;
    }

    try {
      setIsSummarizing(true);
      setSummary("");

      const payload = meetingId ? { meetingId } : { transcript };

      const res = await axios.post(`${backendUrl}/api/meetings/summarize`, payload, {
        withCredentials: true,
      });

      if (res.data?.success) {
        setSummary(res.data.summary || "");
        toast.success("AI Summary generated!");
      } else {
        toast.error(res.data?.message || "Failed to generate summary");
      }
    } catch (err) {
      console.error("Summarize error:", err);
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          err.message ||
          "AI summarization failed"
      );
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDownloadTranscript = () => {
    if (!transcript) return;
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${userData?.name || "meeting"}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex flex-col items-center justify-center flex-grow px-6 py-20 md:py-28">
        <div className="w-full max-w-4xl text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Upload Recorded Meeting</h1>
          <p className="text-gray-500 mb-8">
            Upload audio recordings (WAV / MP3 / M4A). Our AI will transcribe and summarize them automatically.
          </p>

          <div className="bg-white shadow-md rounded-xl p-8 mb-10 text-left">
            <label className="block mb-4 font-medium text-gray-700">Choose Meeting Audio File:</label>
            <input type="file" accept="audio/*" onChange={handleFileChange}
              className="block w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-2" />

            <div className="flex items-center gap-4 mt-6">
              <button onClick={handleUpload} disabled={isUploading}
                className={`px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition ${isUploading ? "opacity-70 cursor-not-allowed" : ""}`}>
                {isUploading ? `Uploading (${uploadProgress}%)` : "Upload & Transcribe"}
              </button>

              <button onClick={() => { setFile(null); setTranscript(""); setSummary(""); setMeetingId(null); }}
                className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100">Reset</button>

              <div className="ml-auto text-sm text-gray-500">
                {file ? <>Selected: <span className="font-medium">{file.name}</span></> : <>No file selected</>}
              </div>
            </div>

            {isUploading && (
              <div className="mt-4 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow p-6 text-left">
              <h3 className="text-lg font-semibold mb-3">Transcript</h3>
              {transcript ? (
                <>
                  <div className="text-gray-700 whitespace-pre-wrap mb-4 max-h-80 overflow-y-auto border p-3 rounded-lg bg-gray-50">
                    {transcript}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleDownloadTranscript} className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100">Download</button>
                    <button onClick={() => { navigator.clipboard.writeText(transcript); toast.success("Transcript copied to clipboard."); }} className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100">Copy</button>
                    <button onClick={handleGenerateSummary} disabled={isSummarizing} className={`ml-auto px-5 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 ${isSummarizing ? "opacity-70 cursor-not-allowed" : ""}`}>
                      {isSummarizing ? "Summarizing..." : "Generate Summary"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">Transcript will appear here once upload completes.</p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow p-6 text-left">
              <h3 className="text-lg font-semibold mb-3">AI Summary (Minutes of Meeting)</h3>
              {summary ? (
                <>
                  <div className="text-gray-700 whitespace-pre-wrap mb-4 max-h-80 overflow-y-auto border p-3 rounded-lg bg-gray-50">{summary}</div>
                  <div className="flex gap-3">
                    <button onClick={() => { navigator.clipboard.writeText(summary); toast.success("Summary copied to clipboard."); }} className="px-4 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100">Copy</button>
                    <button onClick={() => toast.info("Meeting saved successfully.")} className="px-5 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 ml-auto">Save Meeting</button>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">AI summary will appear here after clicking "Generate Summary".</p>
              )}
            </div>
          </div>

          <p className="text-gray-500 text-sm mt-10 flex items-center justify-center gap-1">💡 Tip: For best results, use clear audio (single speaker recommended). Large files may take a few minutes.</p>
        </div>
      </div>
    </div>
  );
};

export default UploadMeeting;
