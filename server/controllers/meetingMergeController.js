import Meeting from "../models/meetingModel.js";
import MeetingMergeLog from "../models/MeetingMergeLog.js";
import { findDuplicates } from "../services/meetingDeduplicationService.js";
import { mergeStructuredMoM, mergeTranscripts } from "../utils/transcriptMerger.js";

export const getDuplicateCandidates = async (req, res) => {
  try {
    const orgId = req.user?.organization;
    if (!orgId) return res.status(400).json({ success: false, message: "Organization not found" });
    
    const duplicates = await findDuplicates(orgId);
    res.json({ success: true, duplicates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const mergeMeetings = async (req, res) => {
  const session = await Meeting.startSession();
  session.startTransaction();
  
  try {
    const { primaryId, duplicateId } = req.body;
    
    const primary = await Meeting.findById(primaryId).session(session);
    const duplicate = await Meeting.findById(duplicateId).session(session);
    
    if (!primary || !duplicate) {
      throw new Error("Meeting not found");
    }
    
    // Create pre-merge snapshot
    const snapshot = {
      primary: primary.toObject(),
      duplicate: duplicate.toObject()
    };
    
    await MeetingMergeLog.create([{
      organization: req.user.organization,
      primaryMeeting: primary._id,
      mergedMeetings: [duplicate._id],
      snapshot,
      mergedBy: req.user._id
    }], { session });
    
    // Merge data
    primary.transcript = mergeTranscripts(primary.transcript, duplicate.transcript);
    primary.structuredMoM = mergeStructuredMoM(primary.structuredMoM, duplicate.structuredMoM);
    
    // Add participant overlap
    const existingEmails = new Set(primary.participants.map(p => p.email));
    duplicate.participants.forEach(p => {
      if (!existingEmails.has(p.email)) {
        primary.participants.push(p);
      }
    });
    
    await primary.save({ session });
    
    // Mark duplicate as merged
    duplicate.status = "failed"; // Treating merged out as failed/invisible
    duplicate.title = "[MERGED] " + duplicate.title;
    await duplicate.save({ session });
    
    await session.commitTransaction();
    res.json({ success: true, message: "Meetings merged successfully." });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};
