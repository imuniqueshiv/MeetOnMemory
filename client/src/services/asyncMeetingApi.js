import apiClient from "./apiClient";

export const getAsyncMeetings = (params) => {
  return apiClient.get("/api/async-meetings", { params });
};

export const submitAsyncUpdate = (id, answers) => {
  return apiClient.post(`/api/async-meetings/${id}/submit`, { answers });
};

export const createAsyncMeeting = (data) => {
  return apiClient.post("/api/async-meetings", data);
};

export const getAsyncMeetingById = (id) => {
  return apiClient.get(`/api/async-meetings/${id}`);
};

const asyncMeetingApi = {
  getAsyncMeetings,
  createAsyncMeeting,
  submitAsyncUpdate,
  getAsyncMeetingById,
};

export default asyncMeetingApi;
