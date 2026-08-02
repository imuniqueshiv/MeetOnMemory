import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import Poll from "../models/pollModel.js";
import { processExpiredPollsBatch } from "../jobs/pollExpirationJob.js";

describe("Batch Process Expired Poll Cleanup (#829)", () => {
  const dummyMeetingId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes expired polls in batches", async () => {
    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    const createMockPoll = (id) => ({
      _id: id,
      meeting: dummyMeetingId,
      isClosed: false,
      expiresAt: new Date(Date.now() - 10000),
      isAnonymous: false,
      save: vi.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
      populate: vi.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
      toObject: vi.fn().mockImplementation(function () {
        return this;
      }),
    });

    const batch1 = [createMockPoll("poll_1"), createMockPoll("poll_2")];
    const batch2 = [createMockPoll("poll_3")];

    let callCount = 0;
    vi.spyOn(Poll, "find").mockImplementation(() => {
      callCount++;
      const results = callCount === 1 ? batch1 : callCount === 2 ? batch2 : [];
      return {
        limit: vi.fn().mockResolvedValue(results),
      };
    });

    const totalProcessed = await processExpiredPollsBatch(mockIo, 2);

    expect(totalProcessed).toBe(3);
    expect(Poll.find).toHaveBeenCalledTimes(2);
    expect(mockIo.to).toHaveBeenCalledWith(dummyMeetingId.toString());
    expect(mockIo.emit).toHaveBeenCalledWith("poll:closed", expect.anything());
  });

  it("handles anonymous polls correctly during batch cleanup", async () => {
    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    const mockPoll = {
      _id: "anon_poll_1",
      meeting: dummyMeetingId,
      isClosed: false,
      expiresAt: new Date(Date.now() - 10000),
      isAnonymous: true,
      options: [
        { text: "Option A", votes: ["user1", "user2"] },
        { text: "Option B", votes: ["user3"] },
      ],
      save: vi.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
      populate: vi.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
      toObject: vi.fn().mockImplementation(function () {
        return {
          _id: this._id,
          meeting: this.meeting,
          isClosed: this.isClosed,
          isAnonymous: this.isAnonymous,
          options: this.options,
        };
      }),
    };

    vi.spyOn(Poll, "find").mockImplementation(() => ({
      limit: vi.fn().mockResolvedValue([mockPoll]),
    }));

    const totalProcessed = await processExpiredPollsBatch(mockIo, 10);

    expect(totalProcessed).toBe(1);
    expect(mockPoll.save).toHaveBeenCalled();
    expect(mockIo.emit).toHaveBeenCalledWith(
      "poll:closed",
      expect.objectContaining({
        options: [
          { text: "Option A", votes: [], voteCount: 2 },
          { text: "Option B", votes: [], voteCount: 1 },
        ],
      }),
    );
  });
});
