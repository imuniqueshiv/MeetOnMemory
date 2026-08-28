import mongoose from "mongoose";
import { jest } from "@jest/globals";
import {
  calculateWeeklyTrends,
  detectOrphanedTopics,
  buildCoOccurrenceGraph,
} from "../services/topicIntelligenceService.js";
import TopicCluster from "../models/topicClusterModel.js";
import TopicIntelligence from "../models/topicIntelligenceModel.js";
import MeetingTopic from "../models/meetingTopicModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";

describe("topicIntelligenceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("calculateWeeklyTrends", () => {
    it("should calculate trends and upsert TopicIntelligence records", async () => {
      // Mock data and dependencies
      const orgId = new mongoose.Types.ObjectId();
      const clusterId1 = new mongoose.Types.ObjectId();

      jest.spyOn(Meeting, "find").mockReturnValue({
        select: jest
          .fn()
          .mockResolvedValue([{ _id: new mongoose.Types.ObjectId() }]),
      });

      jest.spyOn(MeetingTopic, "find").mockResolvedValue([
        {
          topics: [{ clusterId: clusterId1 }],
        },
      ]);

      jest.spyOn(TopicIntelligence, "findOneAndUpdate").mockResolvedValue({});

      const result = await calculateWeeklyTrends(orgId);

      expect(result.success).toBe(true);
      expect(TopicIntelligence.findOneAndUpdate).toHaveBeenCalled();
    });
  });

  describe("detectOrphanedTopics", () => {
    it("should identify topics older than 30 days with no action items or decisions", async () => {
      const orgId = new mongoose.Types.ObjectId();

      jest
        .spyOn(TopicCluster, "find")
        .mockResolvedValue([
          { _id: new mongoose.Types.ObjectId(), label: "Old Topic" },
        ]);

      jest.spyOn(MeetingTopic, "find").mockReturnValue({
        populate: jest.fn().mockResolvedValue([
          {
            meeting: {
              _id: new mongoose.Types.ObjectId(),
              startTime: new Date("2020-01-01"),
            },
            topics: [{ clusterId: new mongoose.Types.ObjectId() }],
          },
        ]),
      });

      jest.spyOn(TopicIntelligence, "findOne").mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          isOrphaned: false,
          save: jest.fn().mockResolvedValue(true),
        }),
      });

      jest.spyOn(ActionItem, "countDocuments").mockResolvedValue(0);
      jest.spyOn(Decision, "countDocuments").mockResolvedValue(0);

      const { orphanedCount } = await detectOrphanedTopics(orgId);
      expect(orphanedCount).toBe(1);
    });
  });

  describe("buildCoOccurrenceGraph", () => {
    it("should build relations for topics occurring in the same meeting", async () => {
      const orgId = new mongoose.Types.ObjectId();
      const clusterId1 = new mongoose.Types.ObjectId();
      const clusterId2 = new mongoose.Types.ObjectId();

      jest
        .spyOn(MeetingTopic, "find")
        .mockResolvedValue([
          { topics: [{ clusterId: clusterId1 }, { clusterId: clusterId2 }] },
        ]);

      jest.spyOn(TopicIntelligence, "findOneAndUpdate").mockResolvedValue({});

      const result = await buildCoOccurrenceGraph(orgId);
      expect(result.success).toBe(true);
      expect(TopicIntelligence.findOneAndUpdate).toHaveBeenCalledTimes(2); // Once for each cluster
    });
  });
});
