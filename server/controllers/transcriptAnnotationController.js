import { transcriptAnnotationService } from "../services/transcriptAnnotationService.js";
import TranscriptAnnotation from "../models/transcriptAnnotationModel.js";

export const createAnnotation = async (req, res) => {
  try {
    const {
      transcript,
      meeting,
      type,
      body,
      color,
      startTime,
      endTime,
      segmentIndex,
    } = req.body;
    const author = req.user._id;

    if (
      !transcript ||
      !meeting ||
      !type ||
      startTime === undefined ||
      endTime === undefined
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const annotation = await transcriptAnnotationService.createAnnotation({
      transcript,
      meeting,
      author,
      type,
      body,
      color,
      startTime,
      endTime,
      segmentIndex,
    });

    res.status(201).json({ success: true, annotation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const listAnnotations = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { type, author, resolved } = req.query;

    const query = { meeting: meetingId };
    if (type) query.type = type;
    if (author) query.author = author;
    if (resolved !== undefined) query.resolved = resolved === "true";

    const annotations =
      await transcriptAnnotationService.listAnnotations(query);
    res.status(200).json({ success: true, annotations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAnnotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { body, color, type } = req.body;

    const existingAnnotation = await TranscriptAnnotation.findById(id);
    if (!existingAnnotation) {
      return res
        .status(404)
        .json({ success: false, message: "Annotation not found" });
    }

    // Only author can update the annotation body, type, color
    if (
      existingAnnotation.author.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this annotation",
      });
    }

    const annotation = await transcriptAnnotationService.updateAnnotation(id, {
      body,
      color,
      type,
    });
    res.status(200).json({ success: true, annotation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteAnnotation = async (req, res) => {
  try {
    const { id } = req.params;
    const existingAnnotation = await TranscriptAnnotation.findById(id);
    if (!existingAnnotation) {
      return res
        .status(404)
        .json({ success: false, message: "Annotation not found" });
    }

    if (
      existingAnnotation.author.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this annotation",
      });
    }

    await transcriptAnnotationService.deleteAnnotation(id);
    res.status(200).json({ success: true, message: "Annotation deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resolveAnnotation = async (req, res) => {
  try {
    const { id } = req.params;
    const annotation = await transcriptAnnotationService.resolveAnnotation(
      id,
      req.user._id,
    );
    res.status(200).json({ success: true, annotation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
