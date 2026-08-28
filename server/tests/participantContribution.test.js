import mongoose from "mongoose";
import { calculateMeetingEquity } from "../services/participantContributionService.js";
import ParticipantContribution from "../models/participantContributionModel.js";

describe("Participant Contribution Service", () => {
  beforeAll(async () => {
    // Setup in-memory db or connect to test db if needed
    // Assuming mongoose is mocked or connected by global setup
  });

  afterEach(async () => {
    // Clean up
    await ParticipantContribution.deleteMany({});
  });

  describe("calculateMeetingEquity", () => {
    it("should return 100 for perfect equality", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      await ParticipantContribution.insertMany([
        {
          meetingId,
          participantId: "user1",
          participantName: "Alice",
          dimensions: {},
          overallImpact: 50,
        },
        {
          meetingId,
          participantId: "user2",
          participantName: "Bob",
          dimensions: {},
          overallImpact: 50,
        },
        {
          meetingId,
          participantId: "user3",
          participantName: "Charlie",
          dimensions: {},
          overallImpact: 50,
        },
      ]);

      const equityScore = await calculateMeetingEquity(meetingId);
      expect(equityScore).toBe(100);
    });

    it("should return a low score for high inequality", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      await ParticipantContribution.insertMany([
        {
          meetingId,
          participantId: "user1",
          participantName: "Alice",
          dimensions: {},
          overallImpact: 100,
        },
        {
          meetingId,
          participantId: "user2",
          participantName: "Bob",
          dimensions: {},
          overallImpact: 0,
        },
        {
          meetingId,
          participantId: "user3",
          participantName: "Charlie",
          dimensions: {},
          overallImpact: 0,
        },
      ]);

      const equityScore = await calculateMeetingEquity(meetingId);
      // Gini calculation: sum of absolute differences = |100-0| + |100-0| + |0-100| + |0-100| = 400
      // Mean = 33.33. Denominator = 2 * 9 * 33.33 = 600. Gini = 400/600 = 0.666
      // Equity Score = (1 - 0.666) * 100 = 33
      expect(equityScore).toBeLessThan(40);
    });

    it("should default to 100 if less than 2 participants", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      await ParticipantContribution.insertMany([
        {
          meetingId,
          participantId: "user1",
          participantName: "Alice",
          dimensions: {},
          overallImpact: 50,
        },
      ]);

      const equityScore = await calculateMeetingEquity(meetingId);
      expect(equityScore).toBe(100);
    });
  });
});
