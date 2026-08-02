import apiClient from "./apiClient";

export const translationApi = {
  getSupportedLanguages: async () => {
    const { data } = await apiClient.get("/api/translations/languages");
    return data;
  },

  requestTranslation: async (meetingId, sourceType, targetLanguage) => {
    const { data } = await apiClient.post("/api/translations/request", {
      meetingId,
      sourceType,
      targetLanguage,
    });
    return data;
  },

  clearTranslationCache: async (meetingId) => {
    const { data } = await apiClient.delete(
      `/api/translations/cache/${meetingId}`,
    );
    return data;
  },
};
