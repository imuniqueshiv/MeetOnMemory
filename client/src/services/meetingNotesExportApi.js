import apiClient from "./apiClient";

/**
 * Download a meeting's notes (summary + action items) as a Markdown file (#2543).
 * Returns a Blob the caller turns into a browser download.
 */
export const downloadMeetingNotesMarkdown = async (meetingId) => {
  const response = await apiClient.get(`/api/meetings/${meetingId}/export`, {
    responseType: "blob",
  });
  return response.data;
};
