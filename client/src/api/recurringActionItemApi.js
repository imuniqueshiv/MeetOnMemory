import apiClient from "./apiClient";

export const getRecurringActionItems = async () => {
  const response = await apiClient.get("/api/recurring-action-items");
  return response.data;
};

export const getRecurringActionItemById = async (id) => {
  const response = await apiClient.get(`/api/recurring-action-items/${id}`);
  return response.data;
};

export const createRecurringActionItem = async (data) => {
  const response = await apiClient.post("/api/recurring-action-items", data);
  return response.data;
};

export const updateRecurringActionItem = async (id, data) => {
  const response = await apiClient.put(
    `/api/recurring-action-items/${id}`,
    data,
  );
  return response.data;
};

export const deleteRecurringActionItem = async (id) => {
  const response = await apiClient.delete(`/api/recurring-action-items/${id}`);
  return response.data;
};
