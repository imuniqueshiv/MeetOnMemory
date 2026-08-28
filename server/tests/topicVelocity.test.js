import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockMeetingTopicFind = jest.fn();
const mockTopicClusterFind = jest.fn();

jest.unstable_mockModule("../models/meetingTopicModel.js", () => ({
  default: {
    find: (...args) => mockMeetingTopicFind(...args),
    findOne: jest.fn(),
    updateMany: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/topicClusterModel.js", () => ({
  default: {
    find: (...args) => mockTopicClusterFind(...args),
    findOne: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule("../services/topicExtractionService.js", () => ({
  extractTopics: jest.fn(),
  extractAllForOrg: jest.fn(),
  clusterTopicsForOrg: jest.fn(),
}));

const { getTopicVelocityAndTrends } =
  await import("../controllers/topicController.js");

describe("Topic Velocity and Trends Controller (#2425)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calculates topic velocity and frequency metrics across meetings", async () => {
    const now = new Date();
    const mockTopics = [
      {
        meeting: {
          _id: "m_1",
          title: "Architecture Review",
          date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // recent
        },
        topics: [
          { name: "Kubernetes", clusterId: "c_1" },
          { name: "GraphQL", clusterId: "c_2" },
        ],
        createdAt: now,
      },
      {
        meeting: {
          _id: "m_2",
          title: "Old Sprint",
          date: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), // prior
        },
        topics: [{ name: "GraphQL", clusterId: "c_2" }],
        createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      },
    ];

    mockMeetingTopicFind.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockTopics),
        }),
      }),
    });

    mockTopicClusterFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: "c_1", label: "DevOps" },
        { _id: "c_2", label: "API" },
      ]),
    });

    const req = {
      user: { organization: "org_1" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await getTopicVelocityAndTrends(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          topics: expect.arrayContaining([
            expect.objectContaining({
              name: "Kubernetes",
              cluster: "DevOps",
              velocity: "accelerating",
            }),
          ]),
          metrics: expect.objectContaining({
            totalTopics: 2,
            totalMeetings: 2,
          }),
        }),
      }),
    );
  });
});
