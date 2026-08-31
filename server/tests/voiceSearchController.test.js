import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleVoiceQuery } from "../controllers/voiceSearchController.js";
import { hybridRetrieve } from "../services/hybridRetrievalService.js";
import VoiceQueryLog from "../models/voiceQueryLogModel.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

vi.mock("../services/hybridRetrievalService.js", () => ({
  hybridRetrieve: vi.fn(),
}));

vi.mock("../models/voiceQueryLogModel.js", () => ({
  default: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: async () => ({
            response: {
              text: () => "Mocked AI Response",
            },
          }),
        };
      }
    },
  };
});

describe("Voice Search Controller", () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      body: {
        queryText: "what was discussed about marketing?",
        organizationId: "org123",
        userId: "user123",
      },
      user: {
        id: "user123",
        organization: "org123",
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if queryText is missing", async () => {
    req.body.queryText = undefined;
    await handleVoiceQuery(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "queryText is required",
    });
  });

  it("should return 403 if organization context is missing", async () => {
    req.user = undefined;
    req.body.organizationId = undefined;
    await handleVoiceQuery(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Organization context is required",
    });
  });

  it("should process query and return AI response successfully", async () => {
    hybridRetrieve.mockResolvedValue({
      results: [
        { type: "meeting", title: "Q1 Review", summary: "Marketing went well" },
      ],
    });

    await handleVoiceQuery(req, res);

    expect(hybridRetrieve).toHaveBeenCalledWith(
      "what was discussed about marketing?",
      "org123",
      { topK: 5 },
    );
    expect(VoiceQueryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: "user123",
        organization: "org123",
        queryText: "what was discussed about marketing?",
        responseText: "Mocked AI Response",
        status: "success",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      query: "what was discussed about marketing?",
      response: "Mocked AI Response",
    });
  });

  it("should handle errors gracefully", async () => {
    hybridRetrieve.mockRejectedValue(new Error("Search failed"));

    await handleVoiceQuery(req, res);

    expect(VoiceQueryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        metadata: { error: "Search failed" },
      }),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Failed to process voice query",
    });
  });
});
