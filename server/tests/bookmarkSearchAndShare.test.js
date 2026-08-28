import {
  getBookmarks,
  shareCollection,
} from "../controllers/bookmarkController.js";
import Bookmark from "../models/bookmarkModel.js";

jest.mock("../models/bookmarkModel.js", () => {
  return {
    __esModule: true,
    default: {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn(),
      insertMany: jest.fn().mockResolvedValue([]),
    },
  };
});

jest.mock("../models/userModel.js", () => {
  return {
    __esModule: true,
    default: {
      find: jest
        .fn()
        .mockResolvedValue([
          { _id: "user-2", email: "test@org.com", organization: "org-1" },
        ]),
    },
  };
});

describe("Bookmarks Search and Share", () => {
  let req, res;
  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { _id: "user-1", organization: "org-1" },
      query: {},
      params: {},
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it("filters bookmarks by search query after populate", async () => {
    req.query = { search: "test note" };

    // Mock the bookmarks returned by find().sort()
    const mockBookmarks = [
      {
        _id: "1",
        notes: "A test note",
        toObject: () => ({ _id: "1", notes: "A test note" }),
      },
      {
        _id: "2",
        notes: "Unrelated",
        toObject: () => ({ _id: "2", notes: "Unrelated" }),
      },
    ];
    Bookmark.sort.mockResolvedValue(mockBookmarks);

    await getBookmarks(req, res);

    expect(Bookmark.find).toHaveBeenCalledWith({ user: "user-1" });
    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ notes: "A test note" }),
      ]),
    );
  });

  it("shares collection with org members", async () => {
    req.params.name = "MyCollection";
    req.body.emails = ["test@org.com"];

    Bookmark.find.mockResolvedValue([
      {
        _id: "b1",
        user: "user-1",
        meeting: "m1",
        notes: "test",
        color: "blue",
        collectionName: "MyCollection",
      },
    ]);

    await shareCollection(req, res);

    expect(Bookmark.insertMany).toHaveBeenCalledWith(
      [
        {
          user: "user-2",
          meeting: "m1",
          collectionName: "Shared: MyCollection",
          notes: "test",
          color: "blue",
        },
      ],
      { ordered: false },
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Collection shared successfully.",
    });
  });
});
