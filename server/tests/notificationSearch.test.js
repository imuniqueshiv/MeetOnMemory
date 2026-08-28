import { getNotifications } from "../controllers/notificationController.js";
import notificationModel from "../models/notificationModel.js";

jest.mock("../models/notificationModel.js", () => {
  return {
    __esModule: true,
    default: {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
      countDocuments: jest.fn().mockResolvedValue(0),
    },
  };
});

describe("getNotifications with search", () => {
  let req, res;
  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: "123" },
      query: { search: "test query" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it("should build search filter correctly", async () => {
    await getNotifications(req, res);

    expect(notificationModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { title: { $regex: "test query", $options: "i" } },
          { description: { $regex: "test query", $options: "i" } },
        ],
      }),
    );
  });
});
