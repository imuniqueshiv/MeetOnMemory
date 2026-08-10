import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ReportBuilder from "../ReportBuilder.jsx";
import reportApi from "../../services/reportApi.js";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }) => <div>{children}</div>,
  Droppable: ({ children }) => children({ provided: {}, placeholder: null }),
  Draggable: ({ children }) => children({ provided: {} }),
}));

vi.mock("../../services/reportApi.js", () => ({
  default: {
    getTemplateById: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    generateReport: vi.fn(),
  },
}));

describe("ReportBuilder Validation (#1370)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents saving template with blank title and displays role=alert error", async () => {
    render(
      <MemoryRouter>
        <ReportBuilder />
      </MemoryRouter>,
    );

    const nameInput = screen.getByDisplayValue("New Report Template");
    fireEvent.change(nameInput, { target: { value: "   " } });

    const saveButton = screen.getByRole("button", { name: /save template/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Template title cannot be empty",
      );
    });

    expect(reportApi.createTemplate).not.toHaveBeenCalled();
  });
});
