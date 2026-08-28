import React, { useState } from "react";
import { toast } from "react-toastify";
import apiClient from "../../services/apiClient";

const ConvertToAsyncModal = ({ isOpen, onClose, meeting }) => {
  const [templateText, setTemplateText] = useState(
    "What did you do yesterday?\nWhat are you doing today?\nAny blockers?",
  );
  const [deadlineDays, setDeadlineDays] = useState(1);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !meeting) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const template = templateText
        .split("\n")
        .filter((q) => q.trim().length > 0);
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + parseInt(deadlineDays, 10));

      const payload = {
        originalMeetingId: meeting._id,
        title: meeting.title + " (Async)",
        participants: meeting.participants.map((p) => p.user?._id || p.user),
        template,
        deadline,
      };

      const res = await apiClient.post("/async-meetings", payload);

      if (res.status === 201) {
        toast.success("Successfully converted to an Async Meeting!");
        onClose();
      } else {
        toast.error("Failed to convert meeting.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Error converting meeting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Convert to Async Meeting
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="p-6 overflow-y-auto max-h-[70vh]"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Converting <strong>{meeting.title}</strong> to an asynchronous
            update. Participants will receive a notification to fill out the
            form before the deadline.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Template Questions (One per line)
            </label>
            <textarea
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
              rows={4}
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Deadline (Days from now)
            </label>
            <input
              type="number"
              min="1"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              {loading ? "Converting..." : "Convert to Async"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConvertToAsyncModal;
