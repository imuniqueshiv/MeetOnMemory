/**
 * MeetingService.js
 *
 * Orchestrator service coordinating:
 * - TranscriptionService
 * - GenerativeAIService
 * - MeetingStorageService
 * - Other domain services (Notifications, Calendar, Knowledge Graph, etc.)
 */

import fs from "fs";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import {
  indexMeeting,
  deleteMeetingFromPinecone,
} from "../utils/embeddingUtils.js";
import {
  processStructuredMoM,
  detectResolutions,
} from "./knowledgeGraphService.js";
import { captureSnapshot } from "./graphSnapshotService.js";
import { checkMeetingDecisionsAgainstPolicies } from "./policyComplianceService.js";
import { createAndPushNotification } from "./notificationService.js";
import eventBus from "./eventBus.js";
import * as calendarService from "./calendarService.js";
import { aiQueue } from "./queueService.js";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "../utils/errors.js";

// Imported specific services and utils
import { validatePath } from "../utils/fileUtils.js";
import { transcribeFile, transcribeAudioUrl } from "./TranscriptionService.js";
import {
  generateMoMWithAI,
  normalizeMoM,
  buildHumanReadableMoM,
} from "./GenerativeAIService.js";
import * as MeetingStorageService from "./MeetingStorageService.js";

export const isValidObjectId = (id) =>
  typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

// ═══════════════════════════════════════════════════════════════
// Private helpers
// ═══════════════════════════════════════════════════════════════

const _runKnowledgeGraph = (meetingDoc, mom) => {
  if (!meetingDoc) return;
  (async () => {
    try {
      await detectResolutions(meetingDoc, mom);
      const kgResults = await processStructuredMoM(meetingDoc, mom);
      try {
        await checkMeetingDecisionsAgainstPolicies(
          meetingDoc,
          kgResults?.decisions,
        );
      } catch (complianceErr) {
        console.error(
          "⚠️ Policy compliance check failed (non-fatal):",
          complianceErr.message,
        );
      }

      // Automatic graph snapshot: capture the post-processing graph state
      // so this meeting's contribution to the knowledge graph is visible
      // in the history/time-travel view. No-ops (storage-wise) if nothing
      // actually changed the graph.
      try {
        await captureSnapshot(meetingDoc.organization || null, {
          trigger: "meeting_processed",
          sourceMeetingId: meetingDoc._id,
        });
      } catch (snapshotErr) {
        console.error(
          "⚠️ Graph snapshot capture failed (non-fatal):",
          snapshotErr.message,
        );
      }
    } catch (kgErr) {
      console.error(
        "⚠️ Knowledge graph processing failed (non-fatal):",
        kgErr.message,
      );
    }
  })();
};

// ═══════════════════════════════════════════════════════════════
// Public service methods
// ═══════════════════════════════════════════════════════════════

export const createMeeting = async (uploaderId, orgId, data, io) => {
  const meeting = await MeetingStorageService.createMeetingRecord({
    uploadedBy: uploaderId,
    organization: orgId || null,
    title: data.title.trim(),
    description: data.description || "",
    meetingType: data.meetingType || "conference",
    date: data.date ? new Date(data.date) : new Date(),
    time: data.time || "",
    duration: data.duration || null,
    location: data.location || "",
    venue: data.venue || "",
    participants: data.participants || [],
    agendaItems: data.agendaItems || [],
    policyDetails: data.policyDetails || null,
    recordingType: data.recordingType || "upload",
    transcript: "",
    summary: "",
    structuredMoM: null,
    status: "uploaded",
  });

  indexMeeting(meeting).catch((err) =>
    console.error("⚠️ indexMeeting error (continuing):", err.message),
  );

  if (orgId && io) {
    User.find({ organization: orgId, _id: { $ne: uploaderId } })
      .then(async (members) => {
        for (const member of members) {
          await createAndPushNotification(
            io,
            member._id,
            "New Meeting Scheduled",
            `A new meeting "${meeting.title}" has been scheduled.`,
            "meetings",
            `/meeting/${meeting._id}`,
            "View Details",
          );
        }
      })
      .catch((err) =>
        console.error("⚠️ Notification error (continuing):", err.message),
      );
  }

  User.findById(uploaderId)
    .then(async (user) => {
      if (user?.calendarSyncEnabled) {
        const eventId = await calendarService.createEvent(user, meeting);
        if (eventId) {
          meeting.googleEventId = eventId;
          await meeting.save();
        }
      }
    })
    .catch((err) =>
      console.error("⚠️ Google Calendar sync error (continuing):", err.message),
    );

  try {
    eventBus.emit("meeting.created", meeting);
  } catch (evtErr) {
    console.error("⚠️ Failed to emit meeting.created event:", evtErr.message);
  }

  return meeting;
};

export const uploadAndTranscribeMeeting = async (
  uploaderId,
  orgId,
  file,
  body,
) => {
  const filePath = file.path;
  console.log("🎙️ Starting transcription...");

  const transcriptText = await transcribeFile(filePath);
  console.log("✅ Transcription completed");

  const meeting = await MeetingStorageService.createMeetingRecord({
    uploadedBy: uploaderId,
    organization: orgId || null,
    title: body.title?.trim() || `Meeting - ${new Date().toLocaleDateString()}`,
    date: body.date ? new Date(body.date) : new Date(),
    meetingType: body.meetingType || "internal",
    fileUrl: file.path,
    transcript: "", // E2EE: Do not store plaintext transcript
    summary: "",
    structuredMoM: null,
    status: "completed",
  });

  indexMeeting(meeting).catch((err) =>
    console.error("⚠️ indexMeeting error (continuing):", err.message),
  );

  try {
    fs.unlinkSync(validatePath(filePath));
  } catch (e) {
    console.warn("⚠️ Could not delete temp file:", e.message);
  }

  return { meeting, transcript: transcriptText };
};

export const uploadAudioForExistingMeeting = async (
  uploaderId,
  meetingId,
  file,
) => {
  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  const meeting = await MeetingStorageService.findMeetingById(meetingId);
  if (!meeting) throw new NotFoundError("Meeting not found");

  if (meeting.uploadedBy.toString() !== uploaderId.toString()) {
    throw new ForbiddenError(
      "You don't have permission to update this meeting",
    );
  }

  const filePath = file.path;
  console.log("🎙️ Transcribing audio for existing meeting...");

  const transcriptText = await transcribeFile(filePath);
  console.log("✅ Transcription completed");

  meeting.transcript = ""; // E2EE: Do not store plaintext transcript
  meeting.fileUrl = file.path;
  meeting.status = "completed";
  await meeting.save();

  // Skip indexing plaintext transcript for E2EE
  // indexMeeting(meeting).catch((err) =>
  //   console.error("⚠️ indexMeeting error (continuing):", err.message),
  // );

  try {
    fs.unlinkSync(validatePath(filePath));
  } catch (e) {
    console.warn("⚠️ Could not delete temp file:", e.message);
  }

  return { meeting, transcript: transcriptText };
};

export const generateMeetingMoM = async (
  userId,
  meetingId,
  transcript,
  date,
  title,
  io,
) => {
  const user = await User.findById(userId);
  if (!user) throw new ForbiddenError("User not found");
  if (!user.organization) {
    throw new ForbiddenError("Forbidden: Organization membership required");
  }

  if (meetingId && !isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  let textToSummarize = (transcript || "").trim();
  let meeting = null;

  if (meetingId) {
    meeting = await MeetingStorageService.findMeetingById(meetingId);
    if (!meeting) throw new NotFoundError("Meeting not found");

    const hasAccess =
      (meeting.organization && meeting.organization.toString() === user.organization.toString()) ||
      (meeting.uploadedBy && meeting.uploadedBy.toString() === userId.toString());

    if (!hasAccess) {
      throw new ForbiddenError("Forbidden: You do not have access to this meeting");
    }

    if (!textToSummarize) {
      textToSummarize = (meeting.transcript || "").trim();
    }
  }

  if (!textToSummarize) {
    throw new ValidationError("No transcript provided.");
  }

  if (aiQueue && aiQueue.isActive) {
    console.log(
      `🚀 Queueing MoM generation job for ${meetingId || "transcript-only"}...`,
    );
    await aiQueue.add("generate-mom", {
      meetingId,
      transcript: textToSummarize,
      date,
      title,
      userId,
    });
    return { queued: true };
  }

  console.log(`🧠 Generating MoM for ${meetingId || "transcript-only"}...`);

  const structured = await generateMoMWithAI(textToSummarize, date, title);
  if (!structured) throw new Error("No summary generated");

  const mom = normalizeMoM(structured, title, date);
  const momText = buildHumanReadableMoM(mom);

  let meetingToUpdate = meeting;

  if (!meetingToUpdate && meetingId) {
    meetingToUpdate = await MeetingStorageService.findMeetingById(meetingId);
  }

  if (!meetingToUpdate && !meetingId) {
    meetingToUpdate = await MeetingStorageService.createMeetingRecord({
      uploadedBy: userId,
      organization: user.organization,
      title: mom.title,
      date: new Date(date),
      transcript: "", // E2EE: Do not save plaintext
      summary: "", // E2EE: Do not save plaintext
      structuredMoM: null, // E2EE: Do not save plaintext
      status: "completed",
    });
    // Skip indexing plaintext MoM for E2EE
  } else if (meetingToUpdate) {
    meetingToUpdate.title = mom.title;
    meetingToUpdate.date = new Date(date);
    // E2EE: We do not save plaintext MoM. The client will encrypt and save it via a separate PATCH request.
    await meetingToUpdate.save();
  }

  console.log("✅ MoM saved to database");

  try {
    if (!meetingId) eventBus.emit("meeting.created", meetingToUpdate);
    eventBus.emit("mom.generated", meetingToUpdate);
  } catch (evtErr) {
    console.error("⚠️ Failed to emit webhook events:", evtErr.message);
  }

  _runKnowledgeGraph(meetingToUpdate, mom);

  if (io && meetingToUpdate?.uploadedBy) {
    createAndPushNotification(
      io,
      meetingToUpdate.uploadedBy,
      "Minutes of Meeting Generated",
      `MoM for "${meetingToUpdate.title}" is ready.`,
      "ai_processing",
      `/meeting/${meetingToUpdate._id}`,
      "View MoM",
    ).catch((err) =>
      console.error("⚠️ Notification error (continuing):", err.message),
    );
  }

  return {
    queued: false,
    mom: structured,
    momText,
    meetingId: meetingToUpdate?._id || meetingId,
  };
};

export const getAllMeetings = async (userId, orgId, queryParams = {}) => {
  const { page = 1, limit = 10, startDate, endDate } = queryParams;

  const queryOptions = [{ uploadedBy: userId }];
  if (orgId) {
    queryOptions.push({ organization: orgId });
  }

  const query = { $or: queryOptions };

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [meetings, total] = await Promise.all([
    MeetingStorageService.getMeetingsQuery(query, skip, parseInt(limit)),
    MeetingStorageService.countMeetingsQuery(query),
  ]);

  return {
    meetings,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

export const getMeetingById = async (meetingId) => {
  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  const meeting = await MeetingStorageService.findMeetingById(meetingId);
  if (!meeting) throw new NotFoundError("Meeting not found");
  return meeting;
};

export const updateMeeting = async (userId, meetingId, data, doc = null) => {
  if (!doc && !isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  const meeting =
    doc ||
    (await MeetingStorageService.findMeetingByQuery({
      _id: meetingId,
      uploadedBy: userId,
    }));
  if (!meeting) throw new NotFoundError("Meeting not found");

  const {
    title,
    description,
    meetingType,
    date,
    time,
    duration,
    location,
    venue,
    tags,
    transcript,
    summary,
    structuredMoM,
  } = data;

  if (title) meeting.title = title.trim();
  if (description !== undefined) meeting.description = description;
  if (meetingType) meeting.meetingType = meetingType;
  if (date) meeting.date = new Date(date);
  if (time !== undefined) meeting.time = time;
  if (duration !== undefined) meeting.duration = duration;
  if (location !== undefined) meeting.location = location;
  if (venue !== undefined) meeting.venue = venue;
  if (tags) meeting.tags = tags;
  if (transcript !== undefined) meeting.transcript = transcript;
  if (summary !== undefined) meeting.summary = summary;
  if (structuredMoM !== undefined) meeting.structuredMoM = structuredMoM;

  await meeting.save();

  // If transcript is encrypted, indexing it in Pinecone might produce garbage embeddings,
  // but we can skip it or let it fail gracefully. Ideally, we shouldn't index ciphertext.
  if (transcript && transcript.startsWith && !transcript.startsWith("eyJ")) {
    indexMeeting(meeting).catch((err) =>
      console.error("⚠️ indexMeeting error (continuing):", err.message),
    );
  }

  if (meeting.googleEventId) {
    User.findById(userId)
      .then(async (user) => {
        if (user?.calendarSyncEnabled) {
          await calendarService.updateEvent(user, meeting);
        }
      })
      .catch((err) =>
        console.error("⚠️ Google Calendar update sync error:", err.message),
      );
  }

  return meeting;
};

export const deleteMeeting = async (doc, meetingId) => {
  let deleted;

  if (doc) {
    const googleEventId = doc.googleEventId;
    const uploadedBy = doc.uploadedBy;
    const meetingIdToDelete = doc._id.toString();
    await doc.deleteOne();

    // Delete from Pinecone (fire-and-forget)
    deleteMeetingFromPinecone(meetingIdToDelete).catch((err) =>
      console.error("⚠️ Pinecone deletion error (continuing):", err.message),
    );

    if (googleEventId) {
      User.findById(uploadedBy)
        .then(async (user) => {
          if (user?.calendarSyncEnabled) {
            await calendarService.deleteEvent(user, googleEventId);
          }
        })
        .catch((err) =>
          console.error("⚠️ Calendar delete sync error:", err.message),
        );
    }
    return;
  }

  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  deleted = await MeetingStorageService.deleteMeetingById(meetingId);
  if (!deleted) throw new NotFoundError("Meeting not found");

  // Delete from Pinecone (fire-and-forget)
  deleteMeetingFromPinecone(meetingId).catch((err) =>
    console.error("⚠️ Pinecone deletion error (continuing):", err.message),
  );

  if (deleted.googleEventId) {
    User.findById(deleted.uploadedBy)
      .then(async (user) => {
        if (user?.calendarSyncEnabled) {
          await calendarService.deleteEvent(user, deleted.googleEventId);
        }
      })
      .catch((err) =>
        console.error("⚠️ Calendar delete sync error:", err.message),
      );
  }
};

export const searchMeetings = async (
  { query, audioUrl },
  orgId = null,
  userId = null,
) => {
  let searchQuery = (query || "").trim();

  if (audioUrl && !searchQuery) {
    console.log("🎧 Transcribing audioUrl for voice search...");
    searchQuery = await transcribeAudioUrl(audioUrl);
    console.log("🔊 Voice transcribed to text:", searchQuery);
  }

  if (!searchQuery) {
    throw new ValidationError("No search query provided");
  }

  console.log(`🔍 Searching meetings for: "${searchQuery}"`);

  const filter = {};
  if (orgId || userId) {
    const queryOptions = [];
    if (orgId) queryOptions.push({ organization: orgId });
    if (userId) queryOptions.push({ uploadedBy: userId });
    if (queryOptions.length > 0) {
      filter.$or = queryOptions;
    }
  }

  const results =
    await MeetingStorageService.searchMeetingsRecords(searchQuery, filter);

  return { query: searchQuery, count: results.length, results };
};

export const notifyLiveMeetingParticipants = async (
  io,
  uploaderId,
  roomId,
  participants,
  orgId,
) => {
  const searchNames = participants.map((p) => p.name).filter(Boolean);
  const searchEmails = participants
    .map((p) => p.email || p.name)
    .filter(Boolean);

  const dbUsers = await User.find({
    organization: orgId,
    $or: [{ email: { $in: searchEmails } }, { name: { $in: searchNames } }],
    _id: { $ne: uploaderId },
  });

  for (const user of dbUsers) {
    await createAndPushNotification(
      io,
      user._id,
      "Live Meeting Started",
      "You have been invited to join a live meeting.",
      "meetings",
      `/meeting-room/${roomId}`,
      "Join Now",
    );
  }

  return { count: dbUsers.length };
};
