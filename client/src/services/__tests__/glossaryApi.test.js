import { describe, expect, it, vi, beforeEach } from "vitest";
import api from "../apiClient.js";
import {
  fetchTerms,
  createTerm,
  updateTerm,
  deleteTerm,
  approveTerm,
  rejectTerm,
  detectTerms,
  extractTerms,
} from "../glossaryApi.js";

vi.mock("../apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("glossaryApi endpoint prefixes (#1878)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches terms from /api/glossary", async () => {
    api.get.mockResolvedValue({ data: [] });
    await fetchTerms({ search: "ROI" });
    expect(api.get).toHaveBeenCalledWith("/api/glossary", {
      params: { search: "ROI" },
    });
  });

  it("creates terms through /api/glossary", async () => {
    api.post.mockResolvedValue({ data: {} });
    const term = { term: "ROI", definition: "Return on investment" };
    await createTerm(term);
    expect(api.post).toHaveBeenCalledWith("/api/glossary", term);
  });

  it("updates terms through /api/glossary/:id", async () => {
    api.put.mockResolvedValue({ data: {} });
    const term = { definition: "Updated definition" };
    await updateTerm("term-123", term);
    expect(api.put).toHaveBeenCalledWith("/api/glossary/term-123", term);
  });

  it("deletes terms through /api/glossary/:id", async () => {
    api.delete.mockResolvedValue({ data: {} });
    await deleteTerm("term-123");
    expect(api.delete).toHaveBeenCalledWith("/api/glossary/term-123");
  });

  it("approves terms through /api/glossary/:id/approve", async () => {
    api.post.mockResolvedValue({ data: {} });
    await approveTerm("term-123");
    expect(api.post).toHaveBeenCalledWith(
      "/api/glossary/term-123/approve",
      undefined,
    );
  });

  it("approves terms with edits through /api/glossary/:id/approve (#2245)", async () => {
    api.post.mockResolvedValue({ data: {} });
    const edits = { definition: "Updated definition" };
    await approveTerm("term-123", edits);
    expect(api.post).toHaveBeenCalledWith(
      "/api/glossary/term-123/approve",
      edits,
    );
  });

  it("rejects terms through /api/glossary/:id/reject (#2245)", async () => {
    api.post.mockResolvedValue({ data: {} });
    await rejectTerm("term-123", "Incorrect definition");
    expect(api.post).toHaveBeenCalledWith("/api/glossary/term-123/reject", {
      reason: "Incorrect definition",
    });
  });

  it("detects glossary terms through /api/glossary/detect", async () => {
    api.post.mockResolvedValue({ data: [] });
    await detectTerms("Return on investment");
    expect(api.post).toHaveBeenCalledWith("/api/glossary/detect", {
      text: "Return on investment",
    });
  });

  it("extracts glossary terms through /api/glossary/extract", async () => {
    api.post.mockResolvedValue({ data: [] });
    await extractTerms("meeting-123");
    expect(api.post).toHaveBeenCalledWith("/api/glossary/extract", {
      meetingId: "meeting-123",
    });
  });
});
