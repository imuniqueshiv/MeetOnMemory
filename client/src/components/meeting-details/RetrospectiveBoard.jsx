import React, { useState, useMemo } from "react";
import { useUser } from "@clerk/clerk-react";
import {
  useRetrospective,
  useSubmitRetrospective,
  useUpvoteRetrospectiveItem,
  useGenerateRetrospectiveAiThemes,
} from "../../hooks/useMeetingRetrospective";
import {
  ThumbsUp,
  Sparkles,
  MessageSquarePlus,
  User,
  Loader2,
} from "lucide-react";
import clsx from "clsx";

const RetrospectiveBoard = ({ meetingId }) => {
  const { user } = useUser();
  const dbUserId = user?.publicMetadata?.dbUserId;

  const { data: retrospective, isLoading: isLoadingRetro } =
    useRetrospective(meetingId);
  const { mutate: submitRetro, isPending: isSubmitting } =
    useSubmitRetrospective(meetingId);
  const { mutate: upvoteItem } = useUpvoteRetrospectiveItem(meetingId);
  const { mutate: generateThemes, isPending: isGeneratingThemes } =
    useGenerateRetrospectiveAiThemes(meetingId);

  const [form, setForm] = useState({
    wentWell: "",
    couldImprove: "",
    actionSuggestions: "",
    isAnonymous: false,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);

  const mySubmission = useMemo(() => {
    return retrospective?.submissions?.find(
      (sub) =>
        sub.userId?._id?.toString() === dbUserId ||
        sub.userId?.toString() === dbUserId,
    );
  }, [retrospective, dbUserId]);

  const handleOpenForm = () => {
    if (mySubmission) {
      setForm({
        wentWell: mySubmission.wentWell || "",
        couldImprove: mySubmission.couldImprove || "",
        actionSuggestions: mySubmission.actionSuggestions || "",
        isAnonymous: mySubmission.isAnonymous || false,
      });
    } else {
      setForm({
        wentWell: "",
        couldImprove: "",
        actionSuggestions: "",
        isAnonymous: false,
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitRetro(form, {
      onSuccess: () => setIsFormOpen(false),
    });
  };

  const handleUpvote = (submissionId, type) => {
    upvoteItem({ submissionId, type });
  };

  const hasUpvoted = (upvotesArray) => {
    return upvotesArray?.some(
      (u) => u?._id?.toString() === dbUserId || u?.toString() === dbUserId,
    );
  };

  if (isLoadingRetro) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm mt-6 mb-6 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const submissions = retrospective?.submissions || [];

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm mt-6 mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Meeting Retrospective
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Reflect on what went well and what could be improved.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {submissions.length > 0 && (
            <button
              onClick={() => generateThemes()}
              disabled={isGeneratingThemes}
              className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium border border-purple-200 dark:border-purple-800"
            >
              {isGeneratingThemes ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate AI Themes
            </button>
          )}
          <button
            onClick={handleOpenForm}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <MessageSquarePlus className="w-4 h-4" />
            {mySubmission ? "Edit Reflection" : "Add Reflection"}
          </button>
        </div>
      </div>

      {retrospective?.aiThemes && (
        <div className="mb-8 p-5 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800/50 rounded-xl">
          <h3 className="text-sm font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4" /> AI Themes & Insights
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {retrospective.aiThemes}
          </p>
        </div>
      )}

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 p-5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                What went well?
              </label>
              <textarea
                value={form.wentWell}
                onChange={(e) => setForm({ ...form, wentWell: e.target.value })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 min-h-[100px] p-3 text-sm"
                placeholder="Share positive outcomes..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                What could improve?
              </label>
              <textarea
                value={form.couldImprove}
                onChange={(e) =>
                  setForm({ ...form, couldImprove: e.target.value })
                }
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 min-h-[100px] p-3 text-sm"
                placeholder="Share areas for improvement..."
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Action Suggestions
            </label>
            <textarea
              value={form.actionSuggestions}
              onChange={(e) =>
                setForm({ ...form, actionSuggestions: e.target.value })
              }
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 min-h-[80px] p-3 text-sm"
              placeholder="Suggest next steps or actions..."
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isAnonymous}
                onChange={(e) =>
                  setForm({ ...form, isAnonymous: e.target.checked })
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
              />
              Submit Anonymously
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save Reflection"}
              </button>
            </div>
          </div>
        </form>
      )}

      {submissions.length === 0 && !isFormOpen ? (
        <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No reflections have been submitted yet. Be the first to share!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Went Well Column */}
          <div>
            <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-4 px-2">
              Went Well
            </h3>
            <div className="space-y-4">
              {submissions
                .filter((s) => s.wentWell)
                .map((sub) => (
                  <div
                    key={sub._id}
                    className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl shadow-sm"
                  >
                    <p className="text-sm text-gray-800 dark:text-gray-200 mb-3 whitespace-pre-wrap">
                      {sub.wentWell}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-emerald-200/50 dark:border-emerald-800/50">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {sub.isAnonymous ? (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" /> Anonymous
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            {sub.userId?.profilePicture ? (
                              <img
                                src={sub.userId.profilePicture}
                                alt={sub.userId.name}
                                className="w-4 h-4 rounded-full"
                              />
                            ) : (
                              <User className="w-3 h-3" />
                            )}
                            {sub.userId?.name || "User"}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleUpvote(sub._id, "wentWell")}
                        className={clsx(
                          "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors",
                          hasUpvoted(sub.wentWellUpvotes)
                            ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200"
                            : "hover:bg-emerald-200 dark:hover:bg-emerald-800/50 text-gray-500 dark:text-gray-400",
                        )}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        {sub.wentWellUpvotes?.length || 0}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Could Improve Column */}
          <div>
            <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-400 mb-4 px-2">
              Could Improve
            </h3>
            <div className="space-y-4">
              {submissions
                .filter((s) => s.couldImprove)
                .map((sub) => (
                  <div
                    key={sub._id}
                    className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl shadow-sm"
                  >
                    <p className="text-sm text-gray-800 dark:text-gray-200 mb-3 whitespace-pre-wrap">
                      {sub.couldImprove}
                    </p>
                    {sub.actionSuggestions && (
                      <div className="mb-3 text-xs p-2 bg-white/50 dark:bg-black/20 rounded border border-rose-100 dark:border-rose-800/50">
                        <span className="font-semibold text-rose-800 dark:text-rose-300 block mb-1">
                          Suggestion:
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {sub.actionSuggestions}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-rose-200/50 dark:border-rose-800/50">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {sub.isAnonymous ? (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" /> Anonymous
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            {sub.userId?.profilePicture ? (
                              <img
                                src={sub.userId.profilePicture}
                                alt={sub.userId.name}
                                className="w-4 h-4 rounded-full"
                              />
                            ) : (
                              <User className="w-3 h-3" />
                            )}
                            {sub.userId?.name || "User"}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleUpvote(sub._id, "couldImprove")}
                        className={clsx(
                          "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors",
                          hasUpvoted(sub.couldImproveUpvotes)
                            ? "bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-200"
                            : "hover:bg-rose-200 dark:hover:bg-rose-800/50 text-gray-500 dark:text-gray-400",
                        )}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        {sub.couldImproveUpvotes?.length || 0}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetrospectiveBoard;
