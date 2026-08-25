import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RecordingConsentModal, {
  CONSENT_STORAGE_KEY,
  hasSavedRecordingConsent,
  saveRecordingConsent,
} from "../RecordingConsentModal";

describe("RecordingConsentModal (#2247)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(
      <RecordingConsentModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("dialog", {
        name: "Recording and AI Transcription Consent Dialog",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders with mandatory confirmation unchecked and proceed button disabled", () => {
    render(
      <RecordingConsentModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        actionType="record"
      />,
    );

    expect(
      screen.getByRole("dialog", {
        name: "Recording and AI Transcription Consent Dialog",
      }),
    ).toBeInTheDocument();

    const proceedBtn = screen.getByTestId("consent-confirm-proceed-button");
    expect(proceedBtn).toBeDisabled();
  });

  it("enables proceed button when checkbox is checked and triggers onConfirm", () => {
    const handleConfirm = vi.fn();
    render(
      <RecordingConsentModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
        actionType="upload"
      />,
    );

    const checkbox = screen.getByTestId("consent-mandatory-checkbox");
    fireEvent.click(checkbox);

    const proceedBtn = screen.getByTestId("consent-confirm-proceed-button");
    expect(proceedBtn).not.toBeDisabled();

    fireEvent.click(proceedBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("persists consent to localStorage when rememberChoice is selected", () => {
    const handleConfirm = vi.fn();
    render(
      <RecordingConsentModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
      />,
    );

    const mandatoryCb = screen.getByTestId("consent-mandatory-checkbox");
    const rememberCb = screen.getByTestId("consent-remember-checkbox");

    fireEvent.click(mandatoryCb);
    fireEvent.click(rememberCb);

    const proceedBtn = screen.getByTestId("consent-confirm-proceed-button");
    fireEvent.click(proceedBtn);

    expect(hasSavedRecordingConsent()).toBe(true);
  });

  it("correctly identifies saved valid consent vs missing consent in helper functions", () => {
    expect(hasSavedRecordingConsent()).toBe(false);

    saveRecordingConsent();
    expect(hasSavedRecordingConsent()).toBe(true);

    // Expired consent test
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ granted: true, expiresAt: pastDate.toISOString() }),
    );

    expect(hasSavedRecordingConsent()).toBe(false);
  });
});
