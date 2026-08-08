import TranscriptAnnotation from "../models/transcriptAnnotationModel.js";
import Transcript from "../models/transcriptModel.js";
import eventBus from "./eventBus.js";

class TranscriptAnnotationService {
  async createAnnotation(data) {
    if (data.startTime > data.endTime) {
      throw new Error("startTime must be less than or equal to endTime");
    }

    const transcript = await Transcript.findById(data.transcript);
    if (!transcript) {
      throw new Error("Transcript not found");
    }

    // Consistency, not authorization. This asserts the two ids the caller
    // supplied refer to the same meeting — it says nothing about whether the
    // *user* may reach that meeting, and two ids belonging to the same foreign
    // meeting satisfy it perfectly. The access check now lives in
    // `createAnnotation` in the controller, which is the layer that has the
    // request's user (Issue #1274).
    if (transcript.meeting.toString() !== data.meeting.toString()) {
      throw new Error("Transcript does not belong to this meeting");
    }

    const annotation = new TranscriptAnnotation(data);
    await annotation.save();

    eventBus.emit("transcript:annotated", annotation);

    return annotation;
  }

  async listAnnotations(query = {}, sort = { startTime: 1 }) {
    return await TranscriptAnnotation.find(query)
      .sort(sort)
      .populate("author", "name email")
      .populate("resolvedBy", "name email");
  }

  async updateAnnotation(id, updates) {
    const annotation = await TranscriptAnnotation.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!annotation) {
      throw new Error("Annotation not found");
    }
    return annotation;
  }

  async deleteAnnotation(id) {
    const annotation = await TranscriptAnnotation.findByIdAndDelete(id);
    if (!annotation) {
      throw new Error("Annotation not found");
    }
    return annotation;
  }

  async resolveAnnotation(id, userId) {
    const annotation = await TranscriptAnnotation.findById(id);
    if (!annotation) {
      throw new Error("Annotation not found");
    }

    annotation.resolved = !annotation.resolved;
    if (annotation.resolved) {
      annotation.resolvedBy = userId;
      annotation.resolvedAt = new Date();
    } else {
      annotation.resolvedBy = null;
      annotation.resolvedAt = null;
    }

    await annotation.save();
    return annotation;
  }
}

export const transcriptAnnotationService = new TranscriptAnnotationService();
