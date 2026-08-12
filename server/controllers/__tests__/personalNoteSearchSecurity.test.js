import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchNotes } from "../personalNoteController.js";
import PersonalNote from "../../models/personalNoteModel.js";
import Meeting from "../../models/meetingModel.js";

vi.mock("../../models/personalNoteModel.js");
vi.mock("../../models/meetingModel.js");
vi.mock("../../utils/rbacPermissions.js", () => ({
  hasPermission: vi.fn(() => true),
}));

describe("Personal Note Search Security (#1390)", () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      user: {
        _id: "user123",
        role: "admin",
        organization: "org123",
      },
      query: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    Meeting.find.mockReturnValue({
      select: vi.fn().mockResolvedValue([{ _id: "m1" }]),
    });
  });

  it("escapes regex metacharacters in search query", async () => {
    req.query.query = "test.*+?^$()";
    PersonalNote.find.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      }),
    });

    await searchNotes(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(PersonalNote.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { title: { $regex: "test\\.\\*\\+\\?\\^\\$\\(\\)", $options: "i" } },
          {
            content: { $regex: "test\\.\\*\\+\\?\\^\\$\\(\\)", $options: "i" },
          },
        ],
      }),
    );
  });

  it("rejects search queries exceeding 200 characters", async () => {
    req.query.query = "a".repeat(201);

    await searchNotes(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Query length cannot exceed 200 characters",
      }),
    );
  });
});
