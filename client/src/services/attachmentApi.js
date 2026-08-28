import apiClient from "./apiClient";

export const attachmentApi = {
  uploadAttachment: (meetingId, formData, onUploadProgress) => {
    return apiClient.post(`/api/meetings/${meetingId}/attachments`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress,
    });
  },

  getAttachments: (meetingId, page = 1, limit = 20) => {
    return apiClient.get(
      `/api/meetings/${meetingId}/attachments?page=${page}&limit=${limit}`,
    );
  },

  downloadAttachment: (meetingId, attachmentId) => {
    return apiClient.get(
      `/api/meetings/${meetingId}/attachments/${attachmentId}/download`,
      {
        responseType: "blob",
      },
    );
  },

  previewAttachment: (meetingId, attachmentId) => {
    return apiClient.get(
      `/api/meetings/${meetingId}/attachments/${attachmentId}/download?inline=true`,
      {
        responseType: "blob",
      },
    );
  },

  deleteAttachment: (meetingId, attachmentId) => {
    return apiClient.delete(
      `/api/meetings/${meetingId}/attachments/${attachmentId}`,
    );
  },
};
