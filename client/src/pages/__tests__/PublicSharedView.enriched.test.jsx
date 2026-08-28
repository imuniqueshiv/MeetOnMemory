import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PublicSharedView from "../PublicSharedView";

vi.mock("../../services", () => ({
  publicSharedApi: {
    getPublicResource: vi.fn(),
    verifyPasscode: vi.fn(),
  },
  savedFilterApi: {
    getSavedFilters: vi.fn().mockResolvedValue({ data: [] }),
    createSavedFilter: vi.fn(),
    deleteSavedFilter: vi.fn(),
  },
}));

import { publicSharedApi } from "../../services";

describe("PublicSharedView enriched sections (#2239)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicSharedApi.getPublicResource.mockResolvedValue({
      data: {
        success: true,
        resourceType: "Meeting",
        data: {
          title: "All Hands",
          description: "Company update",
          date: "2026-08-01T00:00:00.000Z",
          participants: [{}],
          includedSections: {
            transcript: true,
            attachments: true,
            clips: false,
          },
          transcriptExcerpt: [
            {
              speaker: "Host",
              text: "Welcome everyone",
              startTime: 0,
              endTime: 1,
            },
          ],
          attachments: [
            {
              _id: "att-1",
              fileName: "slides.pdf",
              mimeType: "application/pdf",
              fileSize: 4096,
            },
          ],
        },
      },
    });
  });

  it("renders transcript and attachment tabs from schema-backed payload", async () => {
    render(
      <MemoryRouter initialEntries={["/shared/hash123"]}>
        <Routes>
          <Route path="/shared/:hash" element={<PublicSharedView />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("All Hands")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /Transcript/i }));
    expect(screen.getByTestId("shared-transcript-section")).toBeInTheDocument();
    expect(screen.getByText("Welcome everyone")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Attachments/i }));
    expect(
      screen.getByTestId("shared-attachments-section"),
    ).toBeInTheDocument();
    expect(screen.getByText("slides.pdf")).toBeInTheDocument();
  });
});
