import Transcript from "../models/transcriptModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";

class SpeakerIdentificationService {
  /**
   * Applies a speaker mapping to a meeting's transcript, summary, and action items.
   *
   * @param {string} meetingId
   * @param {string} originalLabel
   * @param {string} mappedName
   */
  async applyMapping(meetingId, originalLabel, mappedName) {
    // 1. Update Transcript Segments
    const transcript = await Transcript.findOne({ meeting: meetingId });
    if (transcript) {
      let isTranscriptModified = false;
      for (const segment of transcript.segments) {
        if (segment.speaker === originalLabel) {
          segment.speaker = mappedName;
          isTranscriptModified = true;
        }
      }
      if (isTranscriptModified) {
        await transcript.save();
      }
    }

    // 2. Update Meeting Summary and structuredMoM
    const meeting = await Meeting.findById(meetingId);
    if (meeting) {
      let isMeetingModified = false;

      if (meeting.summary && meeting.summary.includes(originalLabel)) {
        // Use regex for word boundary to avoid partial matches
        const regex = new RegExp(`\\b${originalLabel}\\b`, "g");
        meeting.summary = meeting.summary.replace(regex, mappedName);
        isMeetingModified = true;
      }

      // Update structuredMoM attendees if exists
      if (meeting.structuredMoM && meeting.structuredMoM.attendees) {
        const attendees = meeting.structuredMoM.attendees;
        const index = attendees.findIndex(
          (a) => a === originalLabel || (a.name && a.name === originalLabel),
        );
        if (index !== -1) {
          if (typeof attendees[index] === "string") {
            attendees[index] = mappedName;
          } else if (attendees[index].name) {
            attendees[index].name = mappedName;
          }
          meeting.markModified("structuredMoM");
          isMeetingModified = true;
        }
      }

      if (isMeetingModified) {
        await meeting.save();
      }
    }

    // 3. Update Action Items
    const actionItems = await ActionItem.find({ sourceMeetingId: meetingId });
    const bulkOps = [];

    for (const item of actionItems) {
      let isModified = false;
      let updateDoc = {};

      if (item.owner === originalLabel) {
        updateDoc.owner = mappedName;
        isModified = true;
      }

      if (item.text && item.text.includes(originalLabel)) {
        const regex = new RegExp(`\\b${originalLabel}\\b`, "g");
        updateDoc.text = item.text.replace(regex, mappedName);
        isModified = true;
      }

      if (isModified) {
        bulkOps.push({
          updateOne: {
            filter: { _id: item._id },
            update: { $set: updateDoc },
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      await ActionItem.bulkWrite(bulkOps);
    }
  }

  /**
   * Auto-suggest logic placeholder for mapping new generic labels to existing participants.
   * Based on textual similarity or previous mappings in the org.
   *
   * @param {string} meetingId
   */
  async suggestMappings(meetingId) {
    const meeting = await Meeting.findById(meetingId).populate("participants");
    const transcript = await Transcript.findOne({ meeting: meetingId });

    if (!meeting || !transcript) return [];

    const uniqueSpeakers = [
      ...new Set(transcript.segments.map((s) => s.speaker)),
    ];
    const suggestions = [];

    // Very naive suggestion logic: if it starts with "Speaker" and we have participants, we just list the unique generic speakers.
    // In a real system, we'd use voiceprint AI or previous context.
    const genericSpeakers = uniqueSpeakers.filter((s) =>
      s.toLowerCase().startsWith("speaker"),
    );

    for (const speaker of genericSpeakers) {
      // Return possible options to the client
      suggestions.push({
        originalLabel: speaker,
        options: meeting.participants.map((p) => ({
          name: p.name,
          confidence: 0.5, // mock confidence
        })),
      });
    }

    return suggestions;
  }
}

export default new SpeakerIdentificationService();
