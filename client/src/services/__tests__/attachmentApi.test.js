import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "../apiClient";
import { attachmentApi } from "../attachmentApi";

vi.mock("../apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("attachmentApi (#1988)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockResolvedValue({
      data: { success: true, attachments: [] },
    });
    apiClient.post.mockResolvedValue({ data: { success: true } });
    apiClient.delete.mockResolvedValue({ data: { success: true } });
  });

  it("lists, uploads, downloads, and deletes via /api/meetings/:id/attachments", async () => {
    await attachmentApi.getAttachments("meeting-123");
    await attachmentApi.uploadAttachment("meeting-123", new FormData());
    await attachmentApi.downloadAttachment("meeting-123", "att-1");
    await attachmentApi.deleteAttachment("meeting-123", "att-1");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/meetings/meeting-123/attachments?page=1&limit=20",
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/meetings/meeting-123/attachments",
      expect.any(FormData),
      expect.objectContaining({
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/meetings/meeting-123/attachments/att-1/download",
      { responseType: "blob" },
    );
    expect(apiClient.delete).toHaveBeenCalledWith(
      "/api/meetings/meeting-123/attachments/att-1",
    );
  });
});
