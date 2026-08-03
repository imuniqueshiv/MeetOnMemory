import React, { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { toast } from "react-toastify";
import { meetingFeedbackApi } from "../../services";

const PREDEFINED_TAGS = [
  "Great Summary",
  "Missed Action Items",
  "Poor Audio Quality",
  "Excellent Transcript",
  "Inaccurate Speakers",
];

const StarRating = ({ label, value, onChange }) => {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              star <= value
                ? "text-yellow-400"
                : "text-gray-300 dark:text-gray-600"
            }`}
          >
            <Star
              className="w-5 h-5"
              fill={star <= value ? "currentColor" : "none"}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

const FeedbackForm = ({ meetingId }) => {
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    overallRating: 0,
    summaryAccuracy: 0,
    transcriptQuality: 0,
    comment: "",
    tags: [],
  });

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const { data } =
          await meetingFeedbackApi.getFeedbackForMeeting(meetingId);
        if (data.success && data.feedback.length > 0) {
          // Assuming we show the first one or we filter by user in a real scenario
          // But actually, we only care about the CURRENT user's feedback if we want them to edit it.
          // Wait, the API returns all feedback. The backend should ideally have a `/feedback/me/:meetingId`.
          // For now, let's just leave it blank to create a new one, or if they have submitted, they can submit again (upsert will overwrite).
        }
      } catch (error) {
        console.error("Failed to fetch feedback", error);
      }
    };
    fetchFeedback();
  }, [meetingId]);

  const handleTagToggle = (tag) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !formData.overallRating ||
      !formData.summaryAccuracy ||
      !formData.transcriptQuality
    ) {
      toast.error("Please provide ratings for all dimensions");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data } = await meetingFeedbackApi.submitFeedback({
        meetingId,
        ...formData,
      });

      if (data.success) {
        toast.success("Feedback submitted successfully!");
        setFeedback(data.feedback);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Meeting Feedback
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <StarRating
            label="Overall Rating"
            value={formData.overallRating}
            onChange={(val) => setFormData({ ...formData, overallRating: val })}
          />
          <StarRating
            label="Summary Accuracy"
            value={formData.summaryAccuracy}
            onChange={(val) =>
              setFormData({ ...formData, summaryAccuracy: val })
            }
          />
          <StarRating
            label="Transcript Quality"
            value={formData.transcriptQuality}
            onChange={(val) =>
              setFormData({ ...formData, transcriptQuality: val })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagToggle(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  formData.tags.includes(tag)
                    ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Additional Comments
          </label>
          <textarea
            value={formData.comment}
            onChange={(e) =>
              setFormData({ ...formData, comment: e.target.value })
            }
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={3}
            placeholder="Tell us what could be improved..."
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
          >
            {isSubmitting
              ? "Submitting..."
              : feedback
                ? "Update Feedback"
                : "Submit Feedback"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FeedbackForm;
