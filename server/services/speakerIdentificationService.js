import Transcript from "../models/transcriptModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import { wordBoundaryRegExp } from "../utils/regexUtils.js";

class SpeakerIdentificationService {
  /**
   * Applies a speaker mapping to a meeting's transcript, summary, and action items.
   *
   * `originalLabel` arrives verbatim in the body of
   * `POST /api/speaker-mappings/:meetingId` and used to be interpolated into
   * `new RegExp(`\\b${originalLabel}\\b`, "g")` before being handed to
   * `String.replace` over `meeting.summary` (Issue #1157).
   *
   * That made the endpoint destructive. `{"originalLabel": ".*"}` compiles to
   * `/\b.*\b/g`, matches the whole summary, and `meeting.save()` commits the
   * replacement — the minutes become the mapped name and the original text is
   * gone. `revertMapping` calls back into here with the arguments swapped,
   * which cannot reconstruct it, and `applyMapping` writes no `NoteVersion`
   * snapshot, so there is nothing to restore from either.
   *
   * The label is now treated as a literal, and an empty or whitespace-only
   * label is refused rather than being used to rewrite the document.
   *
   * @param {string} meetingId
   * @param {string} originalLabel
   * @param {string} mappedName
   */
  async applyMapping(meetingId, originalLabel, mappedName) {
    // Trimmed, not merely checked for emptiness: the label is compared against
    // stored values (`segment.speaker === label`), so `" #1 "` would otherwise
    // pass validation, match nothing, and complete without applying the
    // mapping the caller asked for.
    const label = String(originalLabel ?? "").trim();
    if (!label) {
      throw new Error("Speaker label must not be empty");
    }

    const replacement = String(mappedName ?? "");

    // Built once and reused for both the summary and the action item pass.
    // `lastIndex` on a `/g` regex is per-object state, so sharing one instance
    // across `String.replace` calls is safe (replace resets it) but sharing it
    // with an `exec` loop would not be — hence a helper rather than a module
    // constant.
    const labelPattern = wordBoundaryRegExp(label, "g");

    // The *replacement* string is the other half of this bug, and it is the
    // half that escaping the pattern does not fix: `String.prototype.replace`
    // expands `$&`, `` $` ``, `$'` and `$1`…`$9` inside the replacement.
    //
    //   "Speaker 1 opened the review.".replace(/\bSpeaker 1\b/g, "$`")
    //   -> " opened the review."
    //
    //   ...replace(/\bSpeaker 1\b/g, "A$'B")
    //   -> "A opened the review.B opened the review."
    //
    // `mappedName` is caller-supplied, so a mapped name of `` $` `` destroys
    // the summary exactly as a wildcard label did. A function replacement is
    // never interpreted, so this is literal by construction.
    const insertLiteral = () => replacement;

    // 1. Update Transcript Segments
    const transcript = await Transcript.findOne({ meeting: meetingId });
    if (transcript) {
      let isTranscriptModified = false;
      for (const segment of transcript.segments) {
        if (segment.speaker === label) {
          segment.speaker = replacement;
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

      if (meeting.summary && meeting.summary.includes(label)) {
        // Use regex for word boundary to avoid partial matches
        const replaced = meeting.summary.replace(labelPattern, insertLiteral);
        // `includes` finds the label as a substring; the boundary pattern may
        // still match nothing (e.g. the label appears only inside a longer
        // word). Only mark the document dirty if something actually changed,
        // so an unchanged summary is not rewritten and re-saved.
        if (replaced !== meeting.summary) {
          meeting.summary = replaced;
          isMeetingModified = true;
        }
      }

      // Update structuredMoM attendees if exists
      if (meeting.structuredMoM && meeting.structuredMoM.attendees) {
        const attendees = meeting.structuredMoM.attendees;
        const index = attendees.findIndex(
          (a) => a === label || (a.name && a.name === label),
        );
        if (index !== -1) {
          if (typeof attendees[index] === "string") {
            attendees[index] = replacement;
          } else if (attendees[index].name) {
            attendees[index].name = replacement;
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

      if (item.owner === label) {
        updateDoc.owner = replacement;
        isModified = true;
      }

      if (item.text && item.text.includes(label)) {
        const replacedText = item.text.replace(labelPattern, insertLiteral);
        if (replacedText !== item.text) {
          updateDoc.text = replacedText;
          isModified = true;
        }
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
