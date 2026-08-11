import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ConfirmModal from "../ConfirmModal.jsx";

describe("ConfirmModal Component", () => {
  it("renders null when isOpen is false", () => {
    const { container } = render(
      <ConfirmModal isOpen={false} onClose={() => {}} onConfirm={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders modal content correctly when isOpen is true", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Delete Confirmation"
        message="Are you sure you want to proceed?"
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete Confirmation")).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to proceed?"),
    ).toBeInTheDocument();
  });

  it("triggers onConfirm when confirm button is clicked", () => {
    const handleConfirm = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={handleConfirm}
        confirmText="Yes, Delete"
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /yes, delete/i });
    fireEvent.click(confirmButton);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("triggers onClose when cancel button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={handleClose}
        onConfirm={() => {}}
        cancelText="Cancel"
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("triggers onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <ConfirmModal isOpen={true} onClose={handleClose} onConfirm={() => {}} />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
