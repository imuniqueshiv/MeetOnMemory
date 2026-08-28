// server/tests/aiControllerSearch.test.js
import { jest } from "@jest/globals";
import { aiSearch } from "../controllers/aiController.js";
import Membership from "../models/membershipModel.js";
import Meeting from "../models/meetingModel.js";
import * as embeddingUtils from "../utils/embeddingUtils.js";

describe("AI Search Controller (#2012)", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: {
        _id: "507f1f77bcf86cd799439011",
      },
      body: {
        query: "Discuss budget forecast",
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it("returns 400 when search query is empty", async () => {
    req.body.query = "";

    await aiSearch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Validation failed",
      }),
    );
  });

  it("returns 400 when user has no active organization memberships", async () => {
    jest.spyOn(Membership, "find").mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    await aiSearch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Organization context is required",
        results: [],
      }),
    );
  });

  it("performs vector search and filters allowed meetings under user organizations", async () => {
    jest.spyOn(Membership, "find").mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue([
          { organization: "507f1f77bcf86cd799439022" },
          { organization: "507f1f77bcf86cd799439033" },
        ]),
    });

    const mockSearchResults = [
      {
        meetingId: "507f1f77bcf86cd799439044",
        score: 0.95,
        title: "Budget Review",
        snippet: "Q3 Budget Review snippet",
      },
      {
        meetingId: "507f1f77bcf86cd799439055",
        score: 0.88,
        title: "Unauthorized Meeting",
        snippet: "Other Org snippet",
      },
    ];

    jest
      .spyOn(embeddingUtils, "searchVectorStore")
      .mockResolvedValue(mockSearchResults);

    // Only meetingId 507f1f77bcf86cd799439044 is accessible
    jest.spyOn(Meeting, "find").mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: "507f1f77bcf86cd799439044" }]),
    });

    await aiSearch(req, res);

    expect(embeddingUtils.searchVectorStore).toHaveBeenCalledWith(
      "Discuss budget forecast",
      expect.objectContaining({
        organization: ["507f1f77bcf86cd799439022", "507f1f77bcf86cd799439033"],
      }),
    );

    expect(res.json).toHaveBeenCalledWith({
      query: "Discuss budget forecast",
      results: [
        {
          meetingId: "507f1f77bcf86cd799439044",
          score: 0.95,
          title: "Budget Review",
          snippet: "Q3 Budget Review snippet",
        },
      ],
      count: 1,
    });
  });

  it("returns empty results array when vector search finds no matches", async () => {
    jest.spyOn(Membership, "find").mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue([{ organization: "507f1f77bcf86cd799439022" }]),
    });

    jest.spyOn(embeddingUtils, "searchVectorStore").mockResolvedValue([]);

    await aiSearch(req, res);

    expect(res.json).toHaveBeenCalledWith({
      query: "Discuss budget forecast",
      results: [],
      count: 0,
    });
  });
});
