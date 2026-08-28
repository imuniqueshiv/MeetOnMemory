import TranscriptChapter from "../models/transcriptChapterModel.js";
import { extractChapters } from "../services/transcriptChapterService.js";

export const getChapters = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const chaptersRecord = await TranscriptChapter.findOne({
      meeting: meetingId,
    });
    if (!chaptersRecord) {
      return res.status(200).json({ success: true, chapters: [] });
    }
    return res
      .status(200)
      .json({ success: true, chapters: chaptersRecord.chapters });
  } catch (error) {
    console.error("Error getting chapters:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const generateChapters = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const orgId = req.user.organization;
    const chaptersRecord = await extractChapters(meetingId, orgId);
    return res
      .status(200)
      .json({ success: true, chapters: chaptersRecord.chapters });
  } catch (error) {
    console.error("Error generating chapters:", error);
    if (error.statusCode) {
      return res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    }
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

export const addChapter = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const newChapter = { ...req.body, isManual: true };

    let chaptersRecord = await TranscriptChapter.findOne({
      meeting: meetingId,
    });
    if (!chaptersRecord) {
      chaptersRecord = new TranscriptChapter({
        meeting: meetingId,
        organization: req.user.organization,
        chapters: [newChapter],
      });
    } else {
      chaptersRecord.chapters.push(newChapter);
      // Sort chapters by startTime
      chaptersRecord.chapters.sort((a, b) => a.startTime - b.startTime);
    }

    await chaptersRecord.save();
    return res
      .status(201)
      .json({ success: true, chapters: chaptersRecord.chapters });
  } catch (error) {
    console.error("Error adding chapter:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateChapter = async (req, res) => {
  try {
    const { meetingId, chapterId } = req.params;
    const updates = req.body;

    const chaptersRecord = await TranscriptChapter.findOne({
      meeting: meetingId,
    });
    if (!chaptersRecord) {
      return res
        .status(404)
        .json({ success: false, message: "Chapters record not found" });
    }

    const chapter = chaptersRecord.chapters.id(chapterId);
    if (!chapter) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    Object.assign(chapter, updates);
    chaptersRecord.chapters.sort((a, b) => a.startTime - b.startTime);

    await chaptersRecord.save();
    return res
      .status(200)
      .json({ success: true, chapters: chaptersRecord.chapters });
  } catch (error) {
    console.error("Error updating chapter:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteChapter = async (req, res) => {
  try {
    const { meetingId, chapterId } = req.params;

    const chaptersRecord = await TranscriptChapter.findOne({
      meeting: meetingId,
    });
    if (!chaptersRecord) {
      return res
        .status(404)
        .json({ success: false, message: "Chapters record not found" });
    }

    chaptersRecord.chapters.pull({ _id: chapterId });

    await chaptersRecord.save();
    return res
      .status(200)
      .json({ success: true, chapters: chaptersRecord.chapters });
  } catch (error) {
    console.error("Error deleting chapter:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
