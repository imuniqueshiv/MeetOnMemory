// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LanguagePreferences from "../LanguagePreferences.jsx";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar" />,
}));

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
  },
}));

describe("LanguagePreferences Translation Audit (#2271)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock global window URL methods for file download
    window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-blob");
    window.URL.revokeObjectURL = vi.fn();

    mockGet.mockImplementation((url) => {
      if (url === "/api/translations/preferences") {
        return Promise.resolve({
          data: {
            autoTranslate: true,
            showConfidenceScores: true,
            preferredProvider: "google",
            defaultSourceLanguage: "en",
            defaultTargetLanguages: ["es", "fr"],
            customGlossary: [],
          },
        });
      }
      if (url === "/api/translations/languages") {
        return Promise.resolve({
          data: {
            languages: [
              { code: "en", name: "English" },
              { code: "es", name: "Spanish" },
              { code: "fr", name: "French" },
            ],
          },
        });
      }
      if (url === "/api/meetings") {
        return Promise.resolve({
          data: {
            meetings: [
              { _id: "meeting-1", title: "Project Sync" },
              { _id: "meeting-2", title: "Design Discussion" },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it("loads and displays the meetings list in the audit select element", async () => {
    render(<LanguagePreferences />);

    await waitFor(() => {
      expect(screen.getByText("Language Preferences")).toBeInTheDocument();
    });

    // Verify meetings are fetched
    expect(mockGet).toHaveBeenCalledWith("/api/meetings");

    const select = screen.getByTestId("audit-meeting-select");
    expect(select).toBeInTheDocument();
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(3);
    expect(options[1]).toHaveTextContent("Project Sync");
    expect(options[2]).toHaveTextContent("Design Discussion");
  });

  it("fetches and displays translation cache history when a meeting is selected", async () => {
    const mockCacheData = {
      translations: [
        {
          _id: "cache-1",
          segmentId: "seg-1",
          sourceText: "Hello world",
          sourceLanguage: "en",
          qualityScore: 90,
          context: { speakerName: "Alice" },
          translations: [
            {
              language: "es",
              text: "Hola mundo",
              provider: "google",
              confidence: 0.95,
            },
          ],
        },
      ],
    };

    mockGet.mockImplementation((url) => {
      if (url === "/api/translations/preferences") {
        return Promise.resolve({
          data: { defaultTargetLanguages: [], customGlossary: [] },
        });
      }
      if (url === "/api/translations/languages") {
        return Promise.resolve({
          data: {
            languages: [
              { code: "en", name: "English" },
              { code: "es", name: "Spanish" },
            ],
          },
        });
      }
      if (url === "/api/meetings") {
        return Promise.resolve({
          data: [{ _id: "meeting-1", title: "Project Sync" }],
        });
      }
      if (url === "/api/translation/cache/meeting-1") {
        return Promise.resolve({ data: mockCacheData });
      }
      return Promise.resolve({ data: {} });
    });

    render(<LanguagePreferences />);

    await waitFor(() => {
      expect(screen.getByTestId("audit-meeting-select")).toBeInTheDocument();
    });

    const select = screen.getByTestId("audit-meeting-select");
    fireEvent.change(select, { target: { value: "meeting-1" } });

    // Verify cache endpoint is hit
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/api/translation/cache/meeting-1");
    });

    // Check segment info rendered
    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeInTheDocument();
      expect(screen.getByText("Segment: seg-1 • Alice")).toBeInTheDocument();
      expect(screen.getByText("Score: 90%")).toBeInTheDocument();
      expect(screen.getByText("es:")).toBeInTheDocument();
      expect(screen.getByText("Hola mundo")).toBeInTheDocument();
    });
  });

  it("fetches and renders segment quality metrics when a segment item is clicked", async () => {
    const mockCacheData = {
      translations: [
        {
          _id: "cache-1",
          segmentId: "seg-1",
          sourceText: "Hello world",
          sourceLanguage: "en",
          qualityScore: 90,
          context: { speakerName: "Alice" },
          translations: [
            {
              language: "es",
              text: "Hola mundo",
              provider: "google",
              confidence: 0.95,
            },
          ],
        },
      ],
    };

    const mockQualityData = {
      segmentId: "seg-1",
      sourceLanguage: "en",
      qualityScore: 90,
      accessCount: 5,
      lastAccessedAt: "2026-08-26T05:00:00.000Z",
      translations: [
        {
          language: "es",
          confidence: 0.95,
          provider: "google",
          corrected: false,
        },
      ],
    };

    mockGet.mockImplementation((url) => {
      if (url === "/api/translations/preferences") {
        return Promise.resolve({
          data: { defaultTargetLanguages: [], customGlossary: [] },
        });
      }
      if (url === "/api/translations/languages") {
        return Promise.resolve({
          data: {
            languages: [
              { code: "en", name: "English" },
              { code: "es", name: "Spanish" },
            ],
          },
        });
      }
      if (url === "/api/meetings") {
        return Promise.resolve({
          data: [{ _id: "meeting-1", title: "Project Sync" }],
        });
      }
      if (url === "/api/translation/cache/meeting-1") {
        return Promise.resolve({ data: mockCacheData });
      }
      if (url === "/api/translation/quality/seg-1?meetingId=meeting-1") {
        return Promise.resolve({ data: mockQualityData });
      }
      return Promise.resolve({ data: {} });
    });

    render(<LanguagePreferences />);

    await waitFor(() => {
      expect(screen.getByTestId("audit-meeting-select")).toBeInTheDocument();
    });

    const select = screen.getByTestId("audit-meeting-select");
    fireEvent.change(select, { target: { value: "meeting-1" } });

    await waitFor(() => {
      expect(
        screen.getByTestId("cache-history-item-seg-1"),
      ).toBeInTheDocument();
    });

    const item = screen.getByTestId("cache-history-item-seg-1");
    fireEvent.click(item);

    // Verify quality endpoint hit
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        "/api/translation/quality/seg-1?meetingId=meeting-1",
      );
    });

    // Check quality metrics panel content
    await waitFor(() => {
      expect(screen.getByText("Segment Quality Details")).toBeInTheDocument();
      expect(
        screen.getByTestId("segment-quality-score-badge"),
      ).toHaveTextContent("90%");
      expect(screen.getByText("Access Count")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("Conf: 95%")).toBeInTheDocument();
      expect(screen.getByText("Provider: google")).toBeInTheDocument();
    });
  });

  it("calls export API and triggers file download when export is submitted", async () => {
    const mockExportResponse = {
      meetingId: "meeting-1",
      languages: ["es"],
      segments: [],
    };

    mockGet.mockImplementation((url) => {
      if (url === "/api/translations/preferences") {
        return Promise.resolve({
          data: { defaultTargetLanguages: [], customGlossary: [] },
        });
      }
      if (url === "/api/translations/languages") {
        return Promise.resolve({
          data: {
            languages: [
              { code: "en", name: "English" },
              { code: "es", name: "Spanish" },
            ],
          },
        });
      }
      if (url === "/api/meetings") {
        return Promise.resolve({
          data: [{ _id: "meeting-1", title: "Project Sync" }],
        });
      }
      return Promise.resolve({ data: {} });
    });

    mockPost.mockResolvedValueOnce({
      data: mockExportResponse,
    });

    render(<LanguagePreferences />);

    await waitFor(() => {
      expect(screen.getByTestId("audit-meeting-select")).toBeInTheDocument();
    });

    // Select meeting
    const select = screen.getByTestId("audit-meeting-select");
    fireEvent.change(select, { target: { value: "meeting-1" } });

    // Wait for export options to render
    await waitFor(() => {
      expect(
        screen.getByText("Export Transcript Translations"),
      ).toBeInTheDocument();
    });

    // Click Spanish checkbox
    const esCheckbox = screen.getByTestId("export-lang-checkbox-es");
    fireEvent.click(esCheckbox);

    // Click Export
    const exportBtn = screen.getByTestId("export-download-btn");
    fireEvent.click(exportBtn);

    // Verify post data
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/translation/export/meeting-1",
        {
          format: "json",
          languages: ["es"],
        },
      );
    });

    // Verify blob URL and download trigger
    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });
});
