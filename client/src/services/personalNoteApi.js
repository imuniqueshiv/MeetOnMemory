import apiClient from "./apiClient";

export const personalNoteApi = {
  getNoteByMeetingId: (meetingId) =>
    apiClient.get(`/personal-notes/${meetingId}`),
  upsertNote: (meetingId, content) =>
    apiClient.post(`/personal-notes/${meetingId}`, { content }),
  addAnnotation: (meetingId, annotationData) =>
    apiClient.post(`/personal-notes/${meetingId}/annotations`, annotationData),
  removeAnnotation: (meetingId, annotationId) =>
    apiClient.delete(
      `/personal-notes/${meetingId}/annotations/${annotationId}`,
    ),
  togglePin: (meetingId, isPinned) =>
    apiClient.patch(`/personal-notes/${meetingId}/pin`, { isPinned }),
  getPinnedNotes: () => apiClient.get(`/personal-notes/pinned`),
  searchNotes: (query) =>
    apiClient.get(`/personal-notes/search`, { params: { q: query } }),
};
