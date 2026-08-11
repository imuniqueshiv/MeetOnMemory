import apiClient from "./apiClient";

export const attachmentApi = {
  uploadAttachment: (meetingId, formData, onUploadProgress) => {
    return apiClient.post(`/meetings/${meetingId}/attachments`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress,
    });
  },

  getAttachments: (meetingId, page = 1, limit = 20) => {
    return apiClient.get(
      `/meetings/${meetingId}/attachments?page=${page}&limit=${limit}`,
    );
  },

  downloadAttachment: (meetingId, attachmentId) => {
    return apiClient.get(
      `/meetings/${meetingId}/attachments/${attachmentId}/download`,
      {
        responseType: "blob", // Important for downloading files
      },
    );
  },

  deleteAttachment: (meetingId, attachmentId) => {
    return apiClient.delete(
      `/meetings/${meetingId}/attachments/${attachmentId}`,
    );
  },
};
