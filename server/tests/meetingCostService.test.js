import mongoose from "mongoose";
import { jest } from "@jest/globals";
import meetingCostService from "../services/meetingCostService.js";
import Meeting from "../models/meetingModel.js";
import MeetingCostConfig from "../models/meetingCostConfigModel.js";

describe("meetingCostService", () => {
  let orgId;

  beforeAll(async () => {
    // Connect to in-memory mongodb or mock
    // Mocking mongoose methods directly is easier for this specific unit test if we don't have a test DB setup.
    orgId = new mongoose.Types.ObjectId();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("calculateMeetingCost", () => {
    it("should return 0 if meeting has no duration", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      jest.spyOn(Meeting, "findById").mockResolvedValue({
        _id: meetingId,
        organization: orgId,
        duration: 0,
      });

      const cost = await meetingCostService.calculateMeetingCost(meetingId);
      expect(cost).toBe(0);
    });

    it("should calculate cost with default config if no config exists", async () => {
      const meetingId = new mongoose.Types.ObjectId();

      jest.spyOn(Meeting, "findById").mockResolvedValue({
        _id: meetingId,
        organization: orgId,
        duration: 60, // 1 hour
        participants: [
          { email: "user1@example.com" },
          { email: "user2@example.com" },
        ],
      });

      jest.spyOn(MeetingCostConfig, "findOne").mockResolvedValue(null);

      // Default rate is 50, 1 hr * 2 participants = 100
      const cost = await meetingCostService.calculateMeetingCost(meetingId);
      expect(cost).toBe(100);
    });

    it("should calculate cost with member overrides and prep time", async () => {
      const meetingId = new mongoose.Types.ObjectId();

      jest.spyOn(Meeting, "findById").mockResolvedValue({
        _id: meetingId,
        organization: orgId,
        duration: 60, // 1 hour
        participants: [
          { email: "user1@example.com" },
          { email: "user2@example.com" },
          { email: "user3@example.com" }, // no override
        ],
      });

      const overrideMap = new Map();
      overrideMap.set("user1@example.com", 100);
      overrideMap.set("user2@example.com", 200);

      jest.spyOn(MeetingCostConfig, "findOne").mockResolvedValue({
        defaultHourlyRate: 50,
        includePreparationTime: true,
        prepTimeMultiplier: 1.5,
        memberRateOverrides: overrideMap,
      });

      // Actual duration: 1 * 1.5 = 1.5 hrs
      // Cost: (100 * 1.5) + (200 * 1.5) + (50 * 1.5) = 150 + 300 + 75 = 525
      const cost = await meetingCostService.calculateMeetingCost(meetingId);
      expect(cost).toBe(525);
    });
  });

  describe("getOrganizationCostAnalytics", () => {
    it("should aggregate total costs correctly", async () => {
      jest.spyOn(Meeting, "find").mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(),
          duration: 60,
          date: new Date("2026-07-01"),
          meetingType: "internal",
          participants: [{ email: "a@test.com" }],
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: "Expensive",
          duration: 120, // 2 hrs
          date: new Date("2026-07-02"),
          meetingType: "policy",
          participants: [{ email: "a@test.com" }, { email: "b@test.com" }],
        },
      ]);

      jest.spyOn(MeetingCostConfig, "findOne").mockResolvedValue(null); // use default $50

      const result = await meetingCostService.getOrganizationCostAnalytics(
        orgId,
        null,
        null,
      );

      expect(result.totalCost).toBe(1 * 50 + 2 * 2 * 50); // 50 + 200 = 250
      expect(result.totalTimeHours).toBe(5); // 1 hr (1 part) + 2 hr (2 part) -> 1*1 + 2*2 = 5 hrs total participant time? Wait, in logic it's meeting.duration * numParticipants. 60*1 + 120*2 = 300 mins = 5 hrs.
      expect(result.mostExpensiveMeeting.title).toBe("Expensive");
    });
  });
});
