import apiClient from "../services/apiClient";

const API_URL = "/api/activities";

export const getActivities = async (params = {}) => {
  const { data } = await apiClient.get(API_URL, {
    params,
    withCredentials: true,
  });
  return data;
};

export const exportActivities = async (params = {}) => {
  return apiClient.get(`${API_URL}/export`, {
    params,
    responseType: "blob",
    withCredentials: true,
  });
};

export const getActivityStats = async () => {
  const { data } = await apiClient.get(`${API_URL}/stats`, {
    withCredentials: true,
  });
  return data;
};
