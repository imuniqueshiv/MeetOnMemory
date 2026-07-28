import {
  uploadAttachment,
  deleteAttachment,
} from "../controllers/attachmentController.js";
import Attachment from "../models/attachmentModel.js";
import { jest } from "@jest/globals";
import fs from "fs";

jest.mock("../models/attachmentModel.js");
jest.mock("../models/meetingModel.js");

// Manually mock fs functions
fs.unlinkSync = jest.fn();
fs.existsSync = jest.fn();

// Manually mock Attachment functions
Attachment.findOne = jest.fn();
Attachment.deleteOne = jest.fn();

describe("Attachment Controller", () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {
        meetingId: "60c72b2f9b1d8b001c8e4d3a",
        id: "60c72b2f9b1d8b001c8e4d3b",
      },
      user: {
        _id: "60c72b2f9b1d8b001c8e4d3c",
        role: "member",
        organization: "org1",
      },
      file: {
        originalname: "test.pdf",
        size: 500000,
        path: "/tmp/test.pdf",
        mimetype: "application/pdf",
      },
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };
    fs.unlinkSync.mockClear();
    fs.existsSync.mockClear();
    fs.existsSync.mockReturnValue(true);
  });

  describe("uploadAttachment", () => {
    it("should reject files over 10MB", async () => {
      req.file.size = 15 * 1024 * 1024; // 15MB
      await uploadAttachment(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "File exceeds 10 MB limit",
      });
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining("test.pdf"),
      );
    });

    it("should reject invalid mime types", async () => {
      req.file.mimetype = "application/x-msdownload"; // exe
      await uploadAttachment(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid file type",
      });
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining("test.pdf"),
      );
    });
  });

  describe("deleteAttachment", () => {
    it("should allow uploader to delete", async () => {
      const mockAttachment = {
        _id: req.params.id,
        uploadedBy: req.user._id,
        filePath: "/tmp/test.pdf",
      };
      Attachment.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockAttachment),
      });
      Attachment.deleteOne.mockResolvedValue({});

      await deleteAttachment(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining("test.pdf"),
      );
      expect(Attachment.deleteOne).toHaveBeenCalled();
    });

    it("should deny unauthorized user", async () => {
      const mockAttachment = {
        _id: req.params.id,
        uploadedBy: "someotheruser",
        meeting: { organization: "org1" },
        filePath: "/tmp/test.pdf",
      };
      Attachment.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockAttachment),
      });

      await deleteAttachment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });
});
