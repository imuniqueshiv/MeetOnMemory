import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CareersAdminQueue from "../../components/admin/CareersAdminQueue";
import {
  getCareerApplications,
  updateCareerApplicationStatus,
} from "../../services/careersApi";
import apiClient from "../../services/apiClient";

// Mock the services
vi.mock("../../services/careersApi", () => ({
  getCareerApplications: vi.fn(),
  updateCareerApplicationStatus: vi.fn(),
}));

vi.mock("../../services/apiClient", () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

describe("CareersAdminQueue Component", () => {
  const mockApplications = [
    {
      _id: "app-1",
      name: "Jane Doe",
      email: "jane@example.com",
      jobId: "ai-engineer",
      jobTitle: "AI Product Engineer",
      coverLetter: "I write high-quality code.",
      portfolio: "https://jane.dev",
      resume: {
        originalName: "cv_jane.pdf",
        storedName: "cv_jane_stored.pdf",
        mimeType: "application/pdf",
      },
      status: "received",
      createdAt: "2026-08-25T10:00:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly and loads applications", async () => {
    getCareerApplications.mockResolvedValue({
      data: {
        success: true,
        data: mockApplications,
      },
    });

    render(<CareersAdminQueue />);

    expect(screen.getByText("Careers Application Queue")).toBeInTheDocument();

    // Check loading indicator during load
    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    expect(screen.getByText("AI Product Engineer")).toBeInTheDocument();
    expect(screen.getByText("received")).toBeInTheDocument();
  });

  it("displays detail pane when application is clicked", async () => {
    getCareerApplications.mockResolvedValue({
      data: {
        success: true,
        data: mockApplications,
      },
    });

    render(<CareersAdminQueue />);

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    // Click on the row to select application
    fireEvent.click(screen.getByText("Jane Doe"));

    expect(screen.getByText("Assessment Worksheet")).toBeInTheDocument();
    expect(screen.getByText("I write high-quality code.")).toBeInTheDocument();
    expect(screen.getByText("Download CV")).toBeInTheDocument();
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
  });

  it("submits status transition and updates review notes", async () => {
    getCareerApplications.mockResolvedValue({
      data: {
        success: true,
        data: mockApplications,
      },
    });

    const updatedApp = {
      ...mockApplications[0],
      status: "reviewing",
      adminNotes: "Strong candidate",
    };

    updateCareerApplicationStatus.mockResolvedValue({
      data: {
        success: true,
        data: updatedApp,
      },
    });

    render(<CareersAdminQueue />);

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Jane Doe"));

    // Select status option "Reviewing"
    const statusSelect = screen.getByLabelText("TRANSITION STATUS");
    fireEvent.change(statusSelect, { target: { value: "reviewing" } });

    // Type notes
    const notesTextarea = screen.getByPlaceholderText(
      /Record interview notes/i,
    );
    fireEvent.change(notesTextarea, { target: { value: "Strong candidate" } });

    // Click submit
    const submitButton = screen.getByText("Commit Assessment");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(updateCareerApplicationStatus).toHaveBeenCalledWith("app-1", {
        status: "reviewing",
        adminNotes: "Strong candidate",
      });
    });
  });

  it("calls resume download API correctly", async () => {
    getCareerApplications.mockResolvedValue({
      data: {
        success: true,
        data: mockApplications,
      },
    });

    apiClient.get.mockResolvedValue({
      data: new Blob(["test"], { type: "application/pdf" }),
    });

    render(<CareersAdminQueue />);

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Jane Doe"));

    const downloadButton = screen.getByText("Download CV");
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/careers/admin/applications/app-1/resume",
        { responseType: "blob" },
      );
    });
  });
});
