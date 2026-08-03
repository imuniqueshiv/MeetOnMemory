import { describe, it, expect, vi, beforeEach } from "vitest";
import { processMessage } from "../services/ragAssistantService.js";

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(function () {
      return {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: vi.fn().mockResolvedValue({
            response: { text: () => "Generated Title" },
          }),
          startChat: vi.fn().mockReturnValue({
            sendMessageStream: vi.fn().mockResolvedValue({
              stream: (async function* () {
                yield { text: () => "Hello " };
                yield { text: () => "world!" };
              })(),
            }),
          }),
        }),
      };
    }),
  };
});

vi.mock("../utils/embeddingUtils.js", () => ({
  embedText: vi.fn().mockResolvedValue([0.1, 0.2]),
  initVectorStore: vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({ matches: [] }),
    namespace: vi.fn().mockReturnValue({
      query: vi.fn().mockResolvedValue({ matches: [] }),
    }),
  }),
}));

vi.mock("../models/ChatSession.js", () => {
  const mockSession = {
    _id: "session-123",
    organizationId: "org-1",
    userId: "user-1",
    messages: [],
    title: "New Chat",
    save: vi.fn().mockResolvedValue(true),
  };
  return {
    default: {
      findOne: vi.fn().mockResolvedValue(mockSession),
    },
  };
});

describe("RAG Assistant Socket Scoping (#810)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should emit streaming response chunks only to scoped target room", async () => {
    const mockScopedEmitter = {
      emit: vi.fn(),
    };

    const mockIo = {
      sockets: {},
      to: vi.fn().mockReturnValue(mockScopedEmitter),
      emit: vi.fn(),
    };

    await processMessage("session-123", "user-1", "Hi assistant", mockIo);

    // Verify io.to was called with user/session rooms
    expect(mockIo.to).toHaveBeenCalledWith([
      "user-1",
      "user:user-1",
      "session:session-123",
    ]);

    // Verify scoped emitter emitted chunk and done events
    expect(mockScopedEmitter.emit).toHaveBeenCalledWith(
      "assistant_message_chunk",
      { sessionId: "session-123", chunk: "Hello " },
    );
    expect(mockScopedEmitter.emit).toHaveBeenCalledWith(
      "assistant_message_chunk",
      { sessionId: "session-123", chunk: "world!" },
    );
    expect(mockScopedEmitter.emit).toHaveBeenCalledWith(
      "assistant_message_done",
      expect.objectContaining({ sessionId: "session-123" }),
    );

    // Ensure global io.emit was NOT called
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
});
