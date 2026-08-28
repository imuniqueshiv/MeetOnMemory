import apiClient from "../services/apiClient";

export const fetchPlaybooks = async () => {
  const { data } = await apiClient.get("/api/playbooks");
  return data;
};

export const fetchPlaybookById = async (id) => {
  const { data } = await apiClient.get(`/api/playbooks/${id}`);
  return data;
};

export const createPlaybook = async (playbookData) => {
  const { data } = await apiClient.post("/api/playbooks", playbookData);
  return data;
};

export const updatePlaybook = async (id, playbookData) => {
  const { data } = await apiClient.put(`/api/playbooks/${id}`, playbookData);
  return data;
};

export const deletePlaybook = async (id) => {
  const { data } = await apiClient.delete(`/api/playbooks/${id}`);
  return data;
};

export const generateAIPlaybook = async (prompt, meetingType) => {
  const { data } = await apiClient.post("/api/playbooks/generate", {
    prompt,
    meetingType,
  });
  return data;
};
