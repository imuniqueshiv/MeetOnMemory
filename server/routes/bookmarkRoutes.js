import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  toggleBookmark,
  getBookmarks,
  getCollections,
  updateBookmark,
  deleteCollection,
} from "../controllers/bookmarkController.js";

const router = express.Router();

router.use(userAuth); // All bookmark routes require authentication

router.post("/toggle", toggleBookmark);
router.get("/", getBookmarks);
router.get("/collections", getCollections);
router.put("/:id", updateBookmark);
router.delete("/collections/:name", deleteCollection);

router.get("/status/:meetingId", async (req, res) => {
  try {
    const Bookmark = (await import("../models/bookmarkModel.js")).default;
    const bookmark = await Bookmark.findOne({
      user: req.user._id,
      meeting: req.params.meetingId,
    });
    res.status(200).json({ bookmarked: !!bookmark, bookmark });
  } catch (_error) {
    res.status(500).json({ message: "Error checking status" });
  }
});

export default router;
