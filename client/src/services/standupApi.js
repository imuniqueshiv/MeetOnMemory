import apiClient from "./apiClient.js";

const standupApi = {
  getReport: (params) => apiClient.get("/api/standup/report", { params }),
};

export default standupApi;
