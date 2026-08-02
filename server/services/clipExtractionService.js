import Transcript from "../models/transcriptModel.js";
import Meeting from "../models/meetingModel.js";

class ClipExtractionService {
  /**
   * Validate time boundaries and extract transcript segments for a given meeting and time range.
   *
   * @param {string} meetingId - The ID of the meeting.
   * @param {number} startTime - The start time in seconds or milliseconds.
   * @param {number} endTime - The end time in seconds or milliseconds.
   * @returns {Promise<Array>} The extracted transcript segments.
   */
  async extractSegments(meetingId, startTime, endTime) {
    if (startTime >= endTime) {
      throw new Error("Start time must be less than end time.");
    }

    if (startTime < 0) {
      throw new Error("Start time cannot be negative.");
    }

    // Verify meeting exists (optional, depends on requirement, but good practice)
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new Error("Meeting not found.");
    }

    const transcript = await Transcript.findOne({ meeting: meetingId });

    if (
      !transcript ||
      !transcript.segments ||
      transcript.segments.length === 0
    ) {
      return [];
    }

    // Extract segments that overlap with the time range
    // Segment start time must be less than clip end time, and segment end time must be greater than clip start time
    const overlappingSegments = transcript.segments.filter((segment) => {
      // Assuming segment times are in the same unit as startTime and endTime
      return segment.startTime < endTime && segment.endTime > startTime;
    });

    return overlappingSegments.map((segment) => ({
      text: segment.text,
      speaker: segment.speaker,
      speakerId: segment.speakerId,
      startTime: segment.startTime,
      endTime: segment.endTime,
    }));
  }
}

export default new ClipExtractionService();
