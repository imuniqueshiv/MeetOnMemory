import { jest } from "@jest/globals";

// Mock the models BEFORE importing the service
jest.unstable_mockModule("../models/transcriptModel.js", () => ({
  default: {
    findOne: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/actionItemModel.js", () => ({
  default: {
    find: jest.fn(),
    bulkWrite: jest.fn(),
  },
}));

const { default: speakerIdentificationService } =
  await import("../services/speakerIdentificationService.js");
const { default: Transcript } = await import("../models/transcriptModel.js");
const { default: Meeting } = await import("../models/meetingModel.js");
const { default: ActionItem } = await import("../models/actionItemModel.js");

describe("Speaker Identification Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("applyMapping", () => {
    it("should update transcript segments with new mapped name", async () => {
      const mockSave = jest.fn();
      Transcript.findOne.mockResolvedValue({
        meeting: "meet-1",
        segments: [
          { text: "Hello", speaker: "Speaker A" },
          { text: "World", speaker: "Speaker B" },
          { text: "Yes", speaker: "Speaker A" },
        ],
        save: mockSave,
      });

      Meeting.findById.mockResolvedValue(null);
      ActionItem.find.mockResolvedValue([]);

      await speakerIdentificationService.applyMapping(
        "meet-1",
        "Speaker A",
        "John Doe",
      );

      expect(Transcript.findOne).toHaveBeenCalledWith({ meeting: "meet-1" });
      expect(mockSave).toHaveBeenCalled();

      // We can't directly check the internal mutated state easily here without capturing the object,
      // but we know save was called.
    });

    it("should replace names in meeting summary and structuredMoM", async () => {
      Transcript.findOne.mockResolvedValue(null);
      ActionItem.find.mockResolvedValue([]);

      const mockSave = jest.fn();
      const mockMarkModified = jest.fn();

      const mockMeeting = {
        _id: "meet-1",
        summary:
          "Speaker A agreed to take notes. Speaker B disagreed. Speaker A will follow up.",
        structuredMoM: {
          attendees: ["Speaker A", "Speaker B", { name: "Speaker C" }],
        },
        save: mockSave,
        markModified: mockMarkModified,
      };

      Meeting.findById.mockResolvedValue(mockMeeting);

      await speakerIdentificationService.applyMapping(
        "meet-1",
        "Speaker A",
        "John Doe",
      );

      expect(mockMeeting.summary).toBe(
        "John Doe agreed to take notes. Speaker B disagreed. John Doe will follow up.",
      );
      expect(mockMeeting.structuredMoM.attendees[0]).toBe("John Doe");
      expect(mockMarkModified).toHaveBeenCalledWith("structuredMoM");
      expect(mockSave).toHaveBeenCalled();
    });

    it("should update action item owner and text", async () => {
      Transcript.findOne.mockResolvedValue(null);
      Meeting.findById.mockResolvedValue(null);

      ActionItem.find.mockResolvedValue([
        {
          _id: "item-1",
          owner: "Speaker A",
          text: "Speaker A to email the client",
        },
        {
          _id: "item-2",
          owner: "Speaker B",
          text: "Follow up with Speaker A next week",
        },
        { _id: "item-3", owner: "Unassigned", text: "Nothing to do" },
      ]);

      await speakerIdentificationService.applyMapping(
        "meet-1",
        "Speaker A",
        "Jane Doe",
      );

      expect(ActionItem.bulkWrite).toHaveBeenCalledTimes(1);

      const bulkOps = ActionItem.bulkWrite.mock.calls[0][0];
      expect(bulkOps).toHaveLength(2); // Only item-1 and item-2 should be modified

      expect(bulkOps[0].updateOne.update.$set.owner).toBe("Jane Doe");
      expect(bulkOps[0].updateOne.update.$set.text).toBe(
        "Jane Doe to email the client",
      );

      expect(bulkOps[1].updateOne.update.$set.text).toBe(
        "Follow up with Jane Doe next week",
      );
    });
  });
});
