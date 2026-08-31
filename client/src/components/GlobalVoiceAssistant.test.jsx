import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import GlobalVoiceAssistant from "./GlobalVoiceAssistant";
import AppContent from "../context/AppContent";
import apiClient from "../services/apiClient";

vi.mock("../services/apiClient", () => ({
  default: {
    post: vi.fn(),
  },
}));

describe("GlobalVoiceAssistant", () => {
  let mockSpeechRecognition;
  let mockRecognitionInstance;

  beforeEach(() => {
    mockRecognitionInstance = {
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
      continuous: false,
      interimResults: false,
      lang: "",
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null,
    };

    mockSpeechRecognition = vi.fn().mockImplementation(function () {
      return mockRecognitionInstance;
    });
    window.SpeechRecognition = mockSpeechRecognition;
    window.webkitSpeechRecognition = mockSpeechRecognition;

    const mockSynth = {
      speak: vi.fn(),
      cancel: vi.fn(),
    };
    Object.defineProperty(window, "speechSynthesis", {
      value: mockSynth,
      writable: true,
    });
    window.SpeechSynthesisUtterance = vi.fn();

    vi.clearAllMocks();
  });

  const renderComponent = (isLoggedin = true) => {
    return render(
      <AppContent.Provider value={{ isLoggedin }}>
        <GlobalVoiceAssistant />
      </AppContent.Provider>,
    );
  };

  it("renders nothing if not logged in", () => {
    const { container } = renderComponent(false);
    expect(container.firstChild).toBeNull();
  });

  it("renders microphone button when logged in", () => {
    renderComponent(true);
    expect(
      screen.getByRole("button", { name: /enable voice assistant/i }),
    ).toBeInTheDocument();
  });

  it("toggles voice assistant active state on click", () => {
    renderComponent(true);
    const button = screen.getByRole("button", {
      name: /enable voice assistant/i,
    });

    // Initial state: inactive
    expect(mockRecognitionInstance.start).not.toHaveBeenCalled();

    // Click to enable
    fireEvent.click(button);
    expect(mockRecognitionInstance.start).toHaveBeenCalledTimes(1);

    // Click to disable
    fireEvent.click(button);
    expect(mockRecognitionInstance.stop).toHaveBeenCalled();
  });

  it("handles query on wake word detection", async () => {
    renderComponent(true);
    const button = screen.getByRole("button", {
      name: /enable voice assistant/i,
    });
    fireEvent.click(button);

    // Simulate recognition start
    if (mockRecognitionInstance.onstart) {
      mockRecognitionInstance.onstart();
    }

    // Simulate wake word
    const mockEvent = {
      results: [[{ transcript: "hey memory what happened in the meeting?" }]],
    };

    apiClient.post.mockResolvedValueOnce({
      data: { success: true, response: "The meeting went well." },
    });

    if (mockRecognitionInstance.onresult) {
      await mockRecognitionInstance.onresult(mockEvent);
    }

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/voice-search/query", {
        queryText: "what happened in the meeting?",
      });
    });

    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });
});
