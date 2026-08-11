import {
  createComment,
  updateComment,
  toggleReaction,
} from "../controllers/commentController.js";
import Comment, { MAX_COMMENT_LENGTH } from "../models/commentModel.js";
import Meeting from "../models/meetingModel.js";
import { jest } from "@jest/globals";
import mongoose from "mongoose";

describe("Comment Controller - Length Validation", () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      user: {
        id: new mongoose.Types.ObjectId().toString(),
        role: "member",
        organization: new mongoose.Types.ObjectId().toString(),
      },
      app: {
        get: jest.fn().mockReturnValue(null),
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.clearAllMocks();
  });

  describe("createComment", () => {
    it("should reject comments exceeding maximum length", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const longBody = "a".repeat(MAX_COMMENT_LENGTH + 1);

      req.body = {
        meetingId,
        body: longBody,
      };

      await createComment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Comment content exceeds maximum length of ${MAX_COMMENT_LENGTH} characters`,
        }),
      );
    });

    it("should reject empty comments", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      req.body = {
        meetingId,
        body: "   ",
      };

      await createComment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Comment body is required",
      });
    });

    it("should accept valid length comments", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      const validBody = "This is a valid comment";

      req.body = {
        meetingId,
        body: validBody,
      };

      jest.spyOn(Meeting, "findById").mockResolvedValue({
        _id: meetingId,
        organization: req.user.organization,
      });

      const mockSave = jest.fn().mockResolvedValue({
        _id: new mongoose.Types.ObjectId().toString(),
        body: validBody,
        populate: jest.fn().mockResolvedValue({}),
      });

      jest.spyOn(Comment.prototype, "save").mockImplementation(mockSave);

      await createComment(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("updateComment", () => {
    it("should reject comment edits exceeding maximum length", async () => {
      const commentId = new mongoose.Types.ObjectId().toString();
      const longBody = "b".repeat(MAX_COMMENT_LENGTH + 1);

      req.params = { id: commentId };
      req.body = { body: longBody };

      await updateComment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Comment content exceeds maximum length of ${MAX_COMMENT_LENGTH} characters`,
        }),
      );
    });
  });

  describe("Error Handling", () => {
    let consoleErrorSpy;

    beforeEach(() => {
      consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it("should return standardized error response on internal failure during createComment", async () => {
      const meetingId = new mongoose.Types.ObjectId().toString();
      req.body = {
        meetingId,
        body: "Valid body",
      };

      const internalError = new Error("Database connection failed");
      jest.spyOn(Meeting, "findById").mockRejectedValue(internalError);

      await createComment(req, res);

      // Verify internal error is logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error creating comment:",
        internalError,
      );

      // Verify response is standardized 500 error
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred. Please try again later.",
        },
      });

      // Verify no stack trace or internal message is exposed
      const jsonArgs = res.json.mock.calls[0][0];
      expect(JSON.stringify(jsonArgs)).not.toContain(
        "Database connection failed",
      );
    });
  });

  describe("toggleReaction", () => {
    it("should handle null or invalid reactions safely", async () => {
      const commentId = new mongoose.Types.ObjectId().toString();
      req.params = { id: commentId };
      req.body = { emoji: "👍" };

      // Setup a comment document mock that has invalid/null entries in reactions
      const mockComment = {
        _id: commentId,
        meeting: new mongoose.Types.ObjectId().toString(),
        reactions: [
          null,
          { emoji: "❤️", user: null },
          { emoji: "👍", user: new mongoose.Types.ObjectId() },
        ],
        save: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        toObject: function () {
          return {
            _id: this._id,
            meeting: this.meeting,
            reactions: this.reactions,
          };
        },
      };

      jest.spyOn(Comment, "findById").mockResolvedValue(mockComment);

      await toggleReaction(req, res);

      // Should succeed and sanitize reactions (filter out invalid reactions)
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockComment.save).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.reactions).toBeDefined();
      expect(responseData.reactions.every((r) => r && r.emoji && r.user)).toBe(
        true,
      );
    });

    it("should reject toggle request if emoji is missing", async () => {
      const commentId = new mongoose.Types.ObjectId().toString();
      req.params = { id: commentId };
      req.body = {};

      await toggleReaction(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Reaction emoji is required",
      });
    });
  });
});
