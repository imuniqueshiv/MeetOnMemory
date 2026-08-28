import apiClient from "../services/apiClient";

export const calendarAvailabilityApi = {
  getFreeBusy: async ({ attendeeEmails, timeMin, timeMax }) => {
    const response = await apiClient.post("/api/calendar/freebusy", {
      attendeeEmails,
      timeMin,
      timeMax,
    });
    return response.data;
  },

  getConnectionStatus: async () => {
    const response = await apiClient.get("/api/calendar/status");
    return response.data;
  },

  getConnectUrl: async (provider) => {
    const path =
      provider === "microsoft"
        ? "/api/calendar/microsoft/connect"
        : "/api/calendar/google/connect";
    const response = await apiClient.get(path);
    return response.data;
  },
};
