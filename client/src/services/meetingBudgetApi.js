import api from "./apiClient.js";

const meetingBudgetApi = {
  createBudget: (payload) => api.post("/api/meeting-budgets", payload),

  listBudgets: () => api.get("/api/meeting-budgets"),

  getSummary: (id) => api.get(`/api/meeting-budgets/${id}/summary`),
};

export default meetingBudgetApi;
