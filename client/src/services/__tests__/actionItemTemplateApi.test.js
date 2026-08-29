import { beforeEach, describe, expect, it, vi } from "vitest";

import apiClient from "../apiClient";
import {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplateToMeeting,
} from "../actionItemTemplateApi";

vi.mock("../apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("actionItemTemplateApi endpoint contract (#2655)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the canonical /api prefix for getTemplates", async () => {
    apiClient.get.mockResolvedValue({ data: { data: [] } });

    await getTemplates();

    expect(apiClient.get).toHaveBeenCalledWith("/api/action-item-templates");
  });

  it("uses the canonical /api prefix for getTemplateById", async () => {
    apiClient.get.mockResolvedValue({ data: { data: {} } });

    await getTemplateById("tpl-123");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/action-item-templates/tpl-123",
    );
  });

  it("uses the canonical /api prefix for createTemplate", async () => {
    apiClient.post.mockResolvedValue({ data: { data: {} } });

    const templateData = { name: "Standup", items: ["Blockers", "Goals"] };
    await createTemplate(templateData);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/action-item-templates",
      templateData,
    );
  });

  it("uses the canonical /api prefix for updateTemplate", async () => {
    apiClient.put.mockResolvedValue({ data: { data: {} } });

    const templateData = { name: "Updated Standup" };
    await updateTemplate("tpl-123", templateData);

    expect(apiClient.put).toHaveBeenCalledWith(
      "/api/action-item-templates/tpl-123",
      templateData,
    );
  });

  it("uses the canonical /api prefix for deleteTemplate", async () => {
    apiClient.delete.mockResolvedValue({ data: { data: {} } });

    await deleteTemplate("tpl-123");

    expect(apiClient.delete).toHaveBeenCalledWith(
      "/api/action-item-templates/tpl-123",
    );
  });

  it("uses the canonical /api prefix for applyTemplateToMeeting", async () => {
    apiClient.post.mockResolvedValue({ data: { data: {} } });

    await applyTemplateToMeeting("tpl-123", "mtg-456");

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/action-item-templates/apply",
      { templateId: "tpl-123", meetingId: "mtg-456" },
    );
  });
});
