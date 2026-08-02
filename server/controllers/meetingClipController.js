import MeetingClip from "../models/meetingClipModel.js";
import clipExtractionService from "../services/clipExtractionService.js";

/**
 * Create a new meeting clip
 */
export const createClip = async (req, res) => {
  try {
    const { meetingId, title, description, startTime, endTime, labels } =
      req.body;

    if (
      !meetingId ||
      !title ||
      startTime === undefined ||
      endTime === undefined
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const transcriptSegments = await clipExtractionService.extractSegments(
      meetingId,
      startTime,
      endTime,
    );

    const newClip = new MeetingClip({
      meeting: meetingId,
      createdBy: req.user._id, // Assumes auth middleware sets req.user
      title,
      description,
      startTime,
      endTime,
      labels,
      transcriptSegments,
    });

    await newClip.save();

    res.status(201).json(newClip);
  } catch (error) {
    console.error("Error creating meeting clip:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to create meeting clip" });
  }
};

/**
 * Get all clips for a specific meeting
 */
export const getClipsForMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const clips = await MeetingClip.find({ meeting: meetingId })
      .populate("createdBy", "name email")
      .populate("annotations.user", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(clips);
  } catch (error) {
    console.error("Error fetching meeting clips:", error);
    res.status(500).json({ error: "Failed to fetch meeting clips" });
  }
};

/**
 * Update a meeting clip
 */
export const updateClip = async (req, res) => {
  try {
    const { clipId } = req.params;
    const { title, description, labels } = req.body;

    const clip = await MeetingClip.findById(clipId);
    if (!clip) {
      return res.status(404).json({ error: "Clip not found" });
    }

    if (title) clip.title = title;
    if (description !== undefined) clip.description = description;
    if (labels) clip.labels = labels;

    await clip.save();

    res.status(200).json(clip);
  } catch (error) {
    console.error("Error updating meeting clip:", error);
    res.status(500).json({ error: "Failed to update meeting clip" });
  }
};

/**
 * Delete a meeting clip
 */
export const deleteClip = async (req, res) => {
  try {
    const { clipId } = req.params;

    const deletedClip = await MeetingClip.findByIdAndDelete(clipId);

    if (!deletedClip) {
      return res.status(404).json({ error: "Clip not found" });
    }

    res.status(200).json({ message: "Clip deleted successfully" });
  } catch (error) {
    console.error("Error deleting meeting clip:", error);
    res.status(500).json({ error: "Failed to delete meeting clip" });
  }
};

/**
 * Add an annotation to a clip
 */
export const addAnnotation = async (req, res) => {
  try {
    const { clipId } = req.params;
    const { text, timestamp } = req.body;

    if (!text || timestamp === undefined) {
      return res.status(400).json({ error: "Text and timestamp are required" });
    }

    const clip = await MeetingClip.findById(clipId);
    if (!clip) {
      return res.status(404).json({ error: "Clip not found" });
    }

    const newAnnotation = {
      text,
      timestamp,
      user: req.user._id,
    };

    clip.annotations.push(newAnnotation);
    await clip.save();

    // Populate user for the returned annotation
    await clip.populate("annotations.user", "name email");

    const addedAnnotation = clip.annotations[clip.annotations.length - 1];

    res.status(201).json(addedAnnotation);
  } catch (error) {
    console.error("Error adding annotation to clip:", error);
    res.status(500).json({ error: "Failed to add annotation" });
  }
};
