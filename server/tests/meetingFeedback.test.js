import {
  submitFeedback,
  getAggregateFeedback,
  deleteFeedback,
} from "../controllers/meetingFeedbackController.js";
import MeetingFeedback from "../models/meetingFeedbackModel.js";
import Meeting from "../models/meetingModel.js";
import { jest } from "@jest/globals";
import mongoose from "mongoose";

describe("Meeting Feedback Controller", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      user: {
        _id: new mongoose.Types.ObjectId().toString(),
        organization: new mongoose.Types.ObjectId().toString(),
      },
      app: {
        get: jest.fn().mockReturnValue({
          to: jest.fn().mockReturnValue({
            emit: jest.fn(),
          }),
        }),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  describe("submitFeedback", () => {
    it("should validate input and save feedback for a participant", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      req.body = {
        meetingId,
        overallRating: 5,
        summaryAccuracy: 4,
        transcriptQuality: 4,
        comment: "Great",
      };

      jest.spyOn(Meeting, "findById").mockResolvedValue({
        _id: meetingId,
        uploadedBy: new mongoose.Types.ObjectId().toString(),
        participants: [{ user: req.user._id }],
      });

      jest.spyOn(MeetingFeedback, "findOneAndUpdate").mockResolvedValue({
        ...req.body,
        _id: "feedbackId",
      });

      await submitFeedback(req, res, next);

      expect(MeetingFeedback.findOneAndUpdate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it("should fail if user is not a participant", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      req.body = {
        meetingId,
        overallRating: 5,
        summaryAccuracy: 5,
        transcriptQuality: 5,
      };

      jest.spyOn(Meeting, "findById").mockResolvedValue({
        _id: meetingId,
        uploadedBy: new mongoose.Types.ObjectId().toString(),
        participants: [],
      });

      await submitFeedback(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });
  });

  describe("getAggregateFeedback", () => {
    it("should return aggregated feedback data grouped by month", async () => {
      const orgId = req.user.organization;
      req.params.orgId = orgId;

      jest.spyOn(MeetingFeedback, "aggregate").mockResolvedValue([
        {
          _id: { year: 2026, month: 7 },
          avgOverall: 4.5,
          avgSummary: 4.0,
          avgTranscript: 4.8,
          count: 10,
        },
      ]);

      await getAggregateFeedback(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [
            {
              month: "Jul 2026",
              overall: 4.5,
              summary: 4,
              transcript: 4.8,
              count: 10,
            },
          ],
        }),
      );
    });
  });

  describe("deleteFeedback", () => {
    it("should delete feedback if owned by user", async () => {
      const feedbackId = new mongoose.Types.ObjectId().toString();
      req.params.id = feedbackId;

      const mockDeleteOne = jest.fn();
      jest.spyOn(MeetingFeedback, "findById").mockResolvedValue({
        _id: feedbackId,
        userId: req.user._id,
        deleteOne: mockDeleteOne,
      });

      await deleteFeedback(req, res);

      expect(mockDeleteOne).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
