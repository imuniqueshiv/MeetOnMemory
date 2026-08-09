import apiClient from "./apiClient";

export const getAttendanceStats = async (params) => {
  const { data } = await apiClient.get("/api/attendance-analytics/stats", {
    params,
  });
  return data;
};

export const getAttendanceHeatmap = async (params) => {
  const { data } = await apiClient.get("/api/attendance-analytics/heatmap", {
    params,
  });
  return data;
};

export const getAttendanceTrends = async (params) => {
  const { data } = await apiClient.get("/api/attendance-analytics/trends", {
    params,
  });
  return data;
};

export const getMeetingTypeBreakdown = async (params) => {
  const { data } = await apiClient.get("/api/attendance-analytics/types", {
    params,
  });
  return data;
};
