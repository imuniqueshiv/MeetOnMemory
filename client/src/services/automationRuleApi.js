import api from "./apiClient.js";

export const fetchRules = async () => {
  const response = await api.get("/automation-rules");
  return response.data.data.rules;
};

export const fetchRuleById = async (id) => {
  const response = await api.get(`/automation-rules/${id}`);
  return response.data.data.rule;
};

export const createRule = async (ruleData) => {
  const response = await api.post("/automation-rules", ruleData);
  return response.data.data.rule;
};

export const updateRule = async (id, ruleData) => {
  const response = await api.put(`/automation-rules/${id}`, ruleData);
  return response.data.data.rule;
};

export const toggleRuleStatus = async (id, enabled) => {
  const response = await api.patch(`/automation-rules/${id}/toggle`, {
    enabled,
  });
  return response.data.data.rule;
};

export const deleteRule = async (id) => {
  const response = await api.delete(`/automation-rules/${id}`);
  return response.data.data;
};
