import React, { useState } from "react";
import { toast } from "react-toastify";
import apiClient from "../../services/apiClient";

const AsyncSubmissionModal = ({ isOpen, onClose, meeting, onSubmitted }) => {
  const [answers, setAnswers] = useState(
    meeting?.template
      ? meeting.template.map((q) => ({ question: q, answer: "" }))
      : [],
  );
  const [loading, setLoading] = useState(false);

  if (!isOpen || !meeting) return null;

  const handleChange = (index, val) => {
    const newAnswers = [...answers];
    newAnswers[index].answer = val;
    setAnswers(newAnswers);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await apiClient.post(
        `/async-meetings/${meeting._id}/submit`,
        { answers },
      );
      if (res.status === 200) {
        toast.success("Update submitted successfully!");
        if (onSubmitted) onSubmitted(res.data);
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Error submitting update");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Submit Update
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              For: {meeting.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 overflow-y-auto flex-grow space-y-6"
        >
          {answers.map((item, index) => (
            <div key={index} className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
                {item.question}
              </label>
              <textarea
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 shadow-sm"
                rows={3}
                value={item.answer}
                onChange={(e) => handleChange(index, e.target.value)}
                placeholder="Type your response here..."
                required
              />
            </div>
          ))}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-8">
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
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium shadow flex items-center disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                  Submitting...
                </>
              ) : (
                "Submit Update"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AsyncSubmissionModal;
