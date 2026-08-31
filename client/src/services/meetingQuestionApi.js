import api from "./apiClient";

export const meetingQuestionApi = {
  getQuestions: (meetingId, config = {}) =>
    api.get(`/api/meetings/${meetingId}/questions`, config),
  submitQuestion: (meetingId, data) =>
    api.post(`/api/meetings/${meetingId}/questions`, data),
  toggleUpvote: (questionId) => api.post(`/api/questions/${questionId}/upvote`),
  updateStatus: (questionId, status) =>
    api.put(`/api/questions/${questionId}/status`, { status }),
};

export default meetingQuestionApi;
