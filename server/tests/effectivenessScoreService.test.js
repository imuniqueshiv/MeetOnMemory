import { jest } from "@jest/globals";

const { default: effectivenessScoreService } =
  await import("../services/effectivenessScoreService.js");
const { default: EffectivenessScore } =
  await import("../models/effectivenessScoreModel.js");
const { default: MeetingGoal } = await import("../models/meetingGoalModel.js");
const { default: ActionItem } = await import("../models/actionItemModel.js");
const { default: MeetingFeedback } =
  await import("../models/meetingFeedbackModel.js");
const { default: Decision } = await import("../models/decisionModel.js");
const { default: MeetingAnalytics } =
  await import("../models/MeetingAnalytics.js");

describe("Effectiveness Score Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe("calculateMeetingScore", () => {
    it("should correctly calculate and save score", async () => {
      // Mock data
      const findOneGoalSpy = jest
        .spyOn(MeetingGoal, "findOne")
        .mockResolvedValue({
          goals: [
            { status: "achieved" },
            { status: "achieved" },
            { status: "partially_achieved" },
            { status: "not_achieved" },
          ],
        }); // Score: (2*1 + 1*0.5) / 4 = 2.5 / 4 = 62.5% -> 63

      jest
        .spyOn(ActionItem, "find")
        .mockResolvedValue([
          { status: "completed" },
          { status: "completed" },
          { status: "completed" },
          { status: "pending" },
        ]); // Score: 3/4 = 75% -> 75

      jest
        .spyOn(MeetingFeedback, "find")
        .mockResolvedValue([{ rating: 4 }, { rating: 5 }]); // Score: 4.5/5 = 90% -> 90

      jest
        .spyOn(Decision, "find")
        .mockResolvedValue([{ status: "final" }, { status: "draft" }]); // Score: 1/2 = 50% -> 50

      jest.spyOn(MeetingAnalytics, "findOne").mockResolvedValue({
        durationMetrics: {
          scheduledDuration: 60,
          actualDuration: 60,
        },
      }); // Score: 100% -> 100

      const findOneAndUpdateScoreSpy = jest
        .spyOn(EffectivenessScore, "findOneAndUpdate")
        .mockImplementation((query, update) => update);

      const result = await effectivenessScoreService.calculateMeetingScore(
        "meetingId",
        "orgId",
      );

      expect(findOneGoalSpy).toHaveBeenCalledWith({
        meetingId: "meetingId",
      });
      expect(findOneAndUpdateScoreSpy).toHaveBeenCalled();

      const { dimensions } = result;
      expect(dimensions.goalCompletionRate).toBe(63);
      expect(dimensions.actionItemFollowThrough).toBe(75);
      expect(dimensions.participantSatisfaction).toBe(90);
      expect(dimensions.decisionClarity).toBe(50);
      expect(dimensions.timeEfficiency).toBe(100);

      // weights = Goals 30%, Action Items 25%, Decisions 20%, Satisfaction 15%, Time 10%
      // 0.3 * 62.5 = 18.75
      // 0.25 * 75 = 18.75
      // 0.2 * 50 = 10
      // 0.15 * 90 = 13.5
      // 0.1 * 100 = 10
      // Overall = 18.75 + 18.75 + 10 + 13.5 + 10 = 71

      expect(result.overallScore).toBe(71);
    });
  });
});
