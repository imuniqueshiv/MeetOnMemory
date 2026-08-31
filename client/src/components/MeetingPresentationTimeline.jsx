import React, { useEffect, useState } from "react";
import apiClient from "../services/apiClient.js";
import { toast } from "react-toastify";

export default function MeetingPresentationTimeline({ meetingId }) {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meetingId) return;

    const fetchChapters = async () => {
      try {
        const res = await apiClient.get(`/api/meetings/${meetingId}/chapters`);
        if (res.data && res.data.success) {
          const visualChapters = res.data.chapters.filter((c) => c.imageUrl);
          setChapters(visualChapters);
        }
      } catch (err) {
        console.error("Failed to load timeline chapters", err);
        toast.error("Failed to load visual timeline");
      } finally {
        setLoading(false);
      }
    };

    fetchChapters();
  }, [meetingId]);

  if (!meetingId) return null;
  if (loading) return <div>Loading presentation timeline...</div>;
  if (chapters.length === 0) return null;

  return (
    <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
      <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
        Presentation Timeline
      </h3>
      <div className="flex overflow-x-auto space-x-4 pb-4 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
        {chapters.map((chapter) => (
          <div
            key={chapter._id || chapter.startTime}
            className="flex-shrink-0 w-64 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {chapter.imageUrl && (
              <img
                src={chapter.imageUrl}
                alt={chapter.title}
                className="w-full h-36 object-cover bg-black"
                onError={(e) => {
                  e.target.src = "/placeholder-image.png";
                }} // Fallback
              />
            )}
            <div className="p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-mono">
                {new Date(chapter.startTime).toLocaleTimeString()}
              </div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                {chapter.title}
              </h4>
              {chapter.summary && (
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 line-clamp-3">
                  {chapter.summary}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
