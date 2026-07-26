// Handles persistence of Yjs CRDT state to/from MongoDB

import Meeting from "../models/meetingModel.js";

/**
 * Loads the serialized Yjs binary state for a given meeting from MongoDB.
 * Returns null if the meeting has no saved CRDT state yet.
 * @param {string} meetingId - MongoDB ObjectId string of the meeting
 * @returns {Promise<Buffer|null>} - Yjs state buffer or null
 */
export const loadDocumentState = async (meetingId) => {
  try {
    const meeting = await Meeting.findById(meetingId)
      .select("crdtState")
      .lean();

    if (!meeting) {
      console.warn(`⚠️  [documentService] Meeting not found: ${meetingId}`);
      return null;
    }

    if (meeting.crdtState) {
      console.log(
        `📂 [documentService] Loaded CRDT state for meeting: ${meetingId}`,
      );
      // Mongoose lean() returns Buffer as a plain object; ensure it's a proper Buffer
      return Buffer.isBuffer(meeting.crdtState)
        ? meeting.crdtState
        : Buffer.from(meeting.crdtState.buffer || meeting.crdtState);
    }

    return null;
  } catch (error) {
    console.error(
      `❌ [documentService] Failed to load state for ${meetingId}:`,
      error.message,
    );
    return null;
  }
};

/**
 * Persists the serialized Yjs binary state and a plain-text snapshot to MongoDB.
 * Uses upsert-style update so it works even if the meeting doc is new.
 *
 * @param {string} meetingId       - MongoDB ObjectId string of the meeting
 * @param {Uint8Array} stateVector - Yjs encoded state (from Y.encodeStateAsUpdate)
 * @param {string} plainText       - Plain-text content snapshot for search/display
 * @returns {Promise<void>}
 */
export const saveDocumentState = async (
  meetingId,
  stateVector,
  plainText = "",
) => {
  try {
    await Meeting.findByIdAndUpdate(
      meetingId,
      {
        $set: {
          crdtState: Buffer.from(stateVector),
          collaborativeNotes: plainText,
        },
      },
      { new: false, runValidators: false },
    );

    console.log(
      `💾 [documentService] Saved CRDT state for meeting: ${meetingId} (${stateVector.byteLength} bytes)`,
    );
  } catch (error) {
    console.error(
      `❌ [documentService] Failed to save state for ${meetingId}:`,
      error.message,
    );
  }
};
