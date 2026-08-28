import apiClient from "../services/apiClient";

export const getChapters = async (meetingId) => {
  const { data } = await apiClient.get(`/api/meetings/${meetingId}/chapters`);
  return data;
};

export const generateChapters = async (meetingId) => {
  const { data } = await apiClient.post(
    `/api/meetings/${meetingId}/chapters/generate`,
  );
  return data;
};

export const addChapter = async (meetingId, chapterData) => {
  const { data } = await apiClient.post(
    `/api/meetings/${meetingId}/chapters`,
    chapterData,
  );
  return data;
};

export const updateChapter = async (meetingId, chapterId, chapterData) => {
  const { data } = await apiClient.put(
    `/api/meetings/${meetingId}/chapters/${chapterId}`,
    chapterData,
  );
  return data;
};

export const deleteChapter = async (meetingId, chapterId) => {
  const { data } = await apiClient.delete(
    `/api/meetings/${meetingId}/chapters/${chapterId}`,
  );
  return data;
};
