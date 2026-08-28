import React, { useState } from "react";
import { useMeetingQA } from "../../hooks/useMeetingQA";
import { useUser } from "@clerk/clerk-react";
import {
  ThumbsUp,
  MessageSquare,
  Check,
  X,
  ShieldQuestion,
} from "lucide-react";
import { toast } from "react-toastify";

const LiveQAPanel = ({ meetingId, isOrganizer }) => {
  const { questions, loading, submitQuestion, toggleUpvote, updateStatus } =
    useMeetingQA(meetingId);
  const { user } = useUser();
  const dbUserId = user?.publicMetadata?.dbUserId;
  const [newQuestion, setNewQuestion] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    try {
      await submitQuestion(newQuestion, isAnonymous);
      setNewQuestion("");
      toast.success("Question submitted!");
    } catch (error) {
      toast.error(error.message || "Failed to submit question");
    }
  };

  const handleUpvote = (questionId) => {
    toggleUpvote(questionId).catch((err) => toast.error(err.message));
  };

  const handleStatusChange = (questionId, status) => {
    updateStatus(questionId, status).catch((err) => toast.error(err.message));
  };

  const sortedQuestions = [...questions]
    .sort((a, b) => {
      if (a.status === "answering" && b.status !== "answering") return -1;
      if (b.status === "answering" && a.status !== "answering") return 1;
      return b.upvotes.length - a.upvotes.length;
    })
    .filter((q) => q.status !== "hidden");

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading Q&A...</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          Live Q&A
        </h3>
        <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-1 rounded-full font-medium">
          {sortedQuestions.length} Questions
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[500px]">
        {sortedQuestions.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <ShieldQuestion className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No questions yet.</p>
            <p className="text-sm">Be the first to ask!</p>
          </div>
        ) : (
          sortedQuestions.map((q) => {
            const hasUpvoted = dbUserId && q.upvotes.includes(dbUserId);
            return (
              <div
                key={q._id}
                className={`p-4 rounded-xl border ${
                  q.status === "answering"
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                    : q.status === "answered"
                      ? "border-green-200 bg-green-50 dark:bg-green-900/10"
                      : q.status === "dismissed"
                        ? "border-gray-200 bg-gray-50 dark:bg-gray-800 opacity-60"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                } transition-all`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium mb-1">
                      {q.text}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {q.isAnonymous
                        ? "Anonymous"
                        : q.author?.name || "Anonymous"}{" "}
                      • {new Date(q.createdAt).toLocaleTimeString()}
                    </p>
                  </div>

                  <button
                    onClick={() => handleUpvote(q._id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                      hasUpvoted
                        ? "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/40"
                        : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <ThumbsUp
                      className={`w-4 h-4 mb-1 ${hasUpvoted ? "fill-current" : ""}`}
                    />
                    <span className="text-xs font-bold">
                      {q.upvotes.length}
                    </span>
                  </button>
                </div>

                {isOrganizer && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                    {q.status !== "answering" && (
                      <button
                        onClick={() => handleStatusChange(q._id, "answering")}
                        className="text-xs font-medium px-2 py-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 rounded"
                      >
                        Answering Now
                      </button>
                    )}
                    {q.status !== "answered" && (
                      <button
                        onClick={() => handleStatusChange(q._id, "answered")}
                        className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 rounded flex items-center"
                      >
                        <Check className="w-3 h-3 mr-1" /> Answered
                      </button>
                    )}
                    {q.status !== "dismissed" && (
                      <button
                        onClick={() => handleStatusChange(q._id, "dismissed")}
                        className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded flex items-center"
                      >
                        <X className="w-3 h-3 mr-1" /> Dismiss
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <form onSubmit={handleSubmit}>
          <textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Ask a question..."
            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2 resize-none"
            rows="2"
          />
          <div className="flex justify-between items-center">
            <label className="flex items-center text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 mr-2"
              />
              Ask anonymously
            </label>
            <button
              type="submit"
              disabled={!newQuestion.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LiveQAPanel;
