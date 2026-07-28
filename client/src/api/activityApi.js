import axios from "axios";

const API_URL = "/api/activities";

export const getActivities = async (params = {}) => {
  const { data } = await axios.get(API_URL, { params, withCredentials: true });
  return data;
};

export const getActivityStats = async () => {
  const { data } = await axios.get(`${API_URL}/stats`, {
    withCredentials: true,
  });
  return data;
};
