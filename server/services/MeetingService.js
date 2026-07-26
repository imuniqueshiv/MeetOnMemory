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
import Membership from "../models/membershipModel.js";
import { captureSnapshot } from "./graphSnapshotService.js";
import eventBus from "./eventBus.js";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "../utils/errors.js";

// Imported specific services and utils
import { validatePath } from "../utils/fileUtils.js";
import * as MeetingStorageService from "./MeetingStorageService.js";

// AI / calendar / queue / transcription stacks are loaded on demand. Static
// imports pull @xenova/transformers, axios diamonds, and related graphs into
// MeetingService's eager ESM link graph and trigger "module is already linked"
// under Jest's VM linker.
const loadEmbeddingUtils = () => import("../utils/embeddingUtils.js");
const loadKnowledgeGraph = () => import("./knowledgeGraphService.js");
const loadPolicyCompliance = () => import("./policyComplianceService.js");
const loadGenerativeAI = () => import("./GenerativeAIService.js");
const loadCalendarService = () => import("./calendarService.js");
const loadQueueService = () => import("./queueService.js");
const loadTranscriptionService = () => import("./TranscriptionService.js");
const scheduleIndexMeeting = (meeting) => {
  loadEmbeddingUtils()
    .then(({ indexMeeting }) => indexMeeting(meeting))
    .catch((err) =>
      console.error("⚠️ indexMeeting error (continuing):", err.message),
    );
};

const scheduleDeleteFromPinecone = (meetingId) => {
  loadEmbeddingUtils()
    .then(({ deleteMeetingFromPinecone }) =>
      deleteMeetingFromPinecone(meetingId),
    )
    .catch((err) =>
      console.error("⚠️ Pinecone deletion error (continuing):", err.message),
    );
};
export const isValidObjectId = (id) =>
  typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

// ═══════════════════════════════════════════════════════════════
// Private helpers
// ═══════════════════════════════════════════════════════════════

const _runKnowledgeGraph = (meetingDoc, mom) => {
  if (!meetingDoc) return;
  (async () => {
    try {
      const [
        { detectResolutions, processStructuredMoM },
        { checkMeetingDecisionsAgainstPolicies },
      ] = await Promise.all([loadKnowledgeGraph(), loadPolicyCompliance()]);

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

export const createMeeting = async (uploaderId, orgId, data) => {
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

  scheduleIndexMeeting(meeting);

  if (orgId) {
    Membership.find({
      organization: orgId,
      status: "active",
      user: { $ne: uploaderId },
    })
      .populate("user")
      .then(async (memberships) => {
        eventBus.emit("meeting.created", {
          meeting,
          membersToNotify: memberships,
        });
      })
      .catch((err) =>
        console.error("⚠️ Notification error (continuing):", err.message),
      );
  }

  // Sync with connected calendars (Google and Microsoft)
  (async () => {
    try {
      const calendarService = await loadCalendarService();

      // Sync with Google Calendar
      const googleEventId = await calendarService.createGoogleEvent(
        uploaderId,
        meeting,
      );
      if (googleEventId) {
        meeting.calendarEvents = meeting.calendarEvents || {};
        meeting.calendarEvents.google = {
          eventId: googleEventId,
          syncedAt: new Date(),
        };
        // Update legacy field for backward compatibility
        meeting.googleEventId = googleEventId;
        await meeting.save();
      }

      // Sync with Microsoft Calendar
      const microsoftEventId = await calendarService.createMicrosoftEvent(
        uploaderId,
        meeting,
      );
      if (microsoftEventId) {
        meeting.calendarEvents = meeting.calendarEvents || {};
        meeting.calendarEvents.microsoft = {
          eventId: microsoftEventId,
          syncedAt: new Date(),
        };
        await meeting.save();
      }
    } catch (err) {
      console.error("⚠️ Calendar sync error (continuing):", err.message);
    }
  })();

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

  const { transcribeFile } = await loadTranscriptionService();
  const transcriptText = await transcribeFile(filePath);
  console.log("✅ Transcription completed");

  const meeting = await MeetingStorageService.createMeetingRecord({
    uploadedBy: uploaderId,
    organization: orgId || null,
    title: body.title?.trim() || `Meeting - ${new Date().toLocaleDateString()}`,
    date: body.date ? new Date(body.date) : new Date(),
    meetingType: body.meetingType || "internal",
    fileUrl: file.path,
    transcript: transcriptText,
    summary: "",
    structuredMoM: null,
    status: "completed",
  });

  scheduleIndexMeeting(meeting);

  try {
    await fs.promises.unlink(validatePath(filePath));
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

  const { transcribeFile } = await loadTranscriptionService();
  const transcriptText = await transcribeFile(filePath);
  console.log("✅ Transcription completed");

  meeting.transcript = transcriptText;
  meeting.fileUrl = file.path;
  meeting.status = "completed";
  await meeting.save();

  scheduleIndexMeeting(meeting);

  try {
    await fs.promises.unlink(validatePath(filePath));
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
      (meeting.organization &&
        meeting.organization.toString() === user.organization.toString()) ||
      (meeting.uploadedBy &&
        meeting.uploadedBy.toString() === userId.toString());

    if (!hasAccess) {
      throw new ForbiddenError(
        "Forbidden: You do not have access to this meeting",
      );
    }

    if (!textToSummarize) {
      textToSummarize = (meeting.transcript || "").trim();
    }
  }

  if (!textToSummarize) {
    throw new ValidationError("No transcript provided.");
  }

  const { aiQueue } = await loadQueueService();
  if (aiQueue && aiQueue.isActive) {
    console.log(
      `🚀 Queueing MoM generation job for ${meetingId || "transcript-only"}...`,
    );
    await aiQueue.add(
      "generate-mom",
      {
        meetingId,
        transcript: textToSummarize,
        date,
        title,
        userId,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000, // Wait 5s, then 10s on retries
        },
      },
    );
    return { queued: true };
  }

  console.log(`🧠 Generating MoM for ${meetingId || "transcript-only"}...`);

  const { generateMoMWithAI, normalizeMoM, buildHumanReadableMoM } =
    await loadGenerativeAI();
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
      transcript: textToSummarize,
      summary: momText,
      structuredMoM: mom,
      status: "completed",
    });
    const { indexMeeting } = await loadEmbeddingUtils();
    await indexMeeting(meetingToUpdate);
  } else if (meetingToUpdate) {
    meetingToUpdate.title = mom.title;
    meetingToUpdate.date = new Date(date);
    meetingToUpdate.summary = momText;
    meetingToUpdate.structuredMoM = mom;
    await meetingToUpdate.save();
  }

  console.log("✅ MoM saved to database");

  try {
    if (!meetingId)
      eventBus.emit("meeting.created", {
        meeting: meetingToUpdate,
        membersToNotify: [],
      }); // Or we could pass actual members, but here it's an ad-hoc meeting
    eventBus.emit("mom.generated", meetingToUpdate);
  } catch (evtErr) {
    console.error("⚠️ Failed to emit webhook events:", evtErr.message);
  }

  _runKnowledgeGraph(meetingToUpdate, mom);

  return {
    queued: false,
    mom: structured,
    momText,
    meetingId: meetingToUpdate?._id || meetingId,
  };
};

export const getAllMeetings = async (userId, orgId, queryParams = {}) => {
  const {
    page = 1,
    limit = 10,
    startDate,
    endDate,
    includeArchived,
  } = queryParams;

  const queryOptions = [{ uploadedBy: userId }];
  if (orgId) {
    queryOptions.push({ organization: orgId });
  }

  const query = { $or: queryOptions };

  if (!includeArchived) {
    query.archived = { $ne: true };
  }

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

  await meeting.save();

  try {
    eventBus.emit("meeting.updated", meeting);
  } catch (evtErr) {
    console.error("⚠️ Failed to emit meeting.updated event:", evtErr.message);
  }

  scheduleIndexMeeting(meeting);

  // Sync updates with connected calendars
  (async () => {
    try {
      const calendarService = await loadCalendarService();

      // Update Google Calendar event
      if (meeting.calendarEvents?.google?.eventId) {
        await calendarService.updateGoogleEvent(
          userId,
          meeting,
          meeting.calendarEvents.google.eventId,
        );
      }
      // Update Microsoft Calendar event
      if (meeting.calendarEvents?.microsoft?.eventId) {
        await calendarService.updateMicrosoftEvent(
          userId,
          meeting,
          meeting.calendarEvents.microsoft.eventId,
        );
      }
    } catch (err) {
      console.error("⚠️ Calendar update sync error:", err.message);
    }
  })();

  return meeting;
};

export const deleteMeeting = async (doc, meetingId) => {
  let deleted;

  if (doc) {
    const googleEventId =
      doc.calendarEvents?.google?.eventId || doc.googleEventId;
    const microsoftEventId = doc.calendarEvents?.microsoft?.eventId;
    const uploadedBy = doc.uploadedBy;
    const meetingIdToDelete = doc._id.toString();
    await doc.deleteOne();

    try {
      eventBus.emit("meeting.deleted", doc);
    } catch (evtErr) {
      console.error("⚠️ Failed to emit meeting.deleted event:", evtErr.message);
    }

    // Delete from Pinecone (fire-and-forget)
    scheduleDeleteFromPinecone(meetingIdToDelete);

    // Delete from connected calendars
    (async () => {
      try {
        const calendarService = await loadCalendarService();
        if (googleEventId) {
          await calendarService.deleteGoogleEvent(uploadedBy, googleEventId);
        }
        if (microsoftEventId) {
          await calendarService.deleteMicrosoftEvent(
            uploadedBy,
            microsoftEventId,
          );
        }
      } catch (err) {
        console.error("⚠️ Calendar delete sync error:", err.message);
      }
    })();
    return;
  }

  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  deleted = await MeetingStorageService.deleteMeetingById(meetingId);
  if (!deleted) throw new NotFoundError("Meeting not found");

  try {
    eventBus.emit("meeting.deleted", deleted);
  } catch (evtErr) {
    console.error("⚠️ Failed to emit meeting.deleted event:", evtErr.message);
  }

  // Delete from Pinecone (fire-and-forget)
  scheduleDeleteFromPinecone(meetingId);

  // Delete from connected calendars
  (async () => {
    try {
      const calendarService = await loadCalendarService();
      const googleEventId =
        deleted.calendarEvents?.google?.eventId || deleted.googleEventId;
      const microsoftEventId = deleted.calendarEvents?.microsoft?.eventId;
      if (googleEventId) {
        await calendarService.deleteGoogleEvent(
          deleted.uploadedBy,
          googleEventId,
        );
      }
      if (microsoftEventId) {
        await calendarService.deleteMicrosoftEvent(
          deleted.uploadedBy,
          microsoftEventId,
        );
      }
    } catch (err) {
      console.error("⚠️ Calendar delete sync error:", err.message);
    }
  })();
};

export const archiveMeeting = async (meetingId) => {
  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  const meeting = await MeetingStorageService.findMeetingById(meetingId);
  if (!meeting) throw new NotFoundError("Meeting not found");

  meeting.archived = true;
  await meeting.save();

  return meeting;
};

export const restoreMeeting = async (meetingId) => {
  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  const meeting = await MeetingStorageService.findMeetingById(meetingId);
  if (!meeting) throw new NotFoundError("Meeting not found");

  meeting.archived = false;
  await meeting.save();

  return meeting;
};

export const searchMeetings = async (
  { query, audioUrl },
  orgId = null,
  userId = null,
) => {
  let searchQuery = (query || "").trim();

  if (audioUrl && !searchQuery) {
    console.log("🎧 Transcribing audioUrl for voice search...");
    const { transcribeAudioUrl } = await loadTranscriptionService();
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

  const results = await MeetingStorageService.searchMeetingsRecords(
    searchQuery,
    filter,
  );

  return { query: searchQuery, count: results.length, results };
};

export const notifyLiveMeetingParticipants = async (
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

  eventBus.emit("live_meeting.notified", {
    uploaderId,
    roomId,
    participants: dbUsers,
    orgId,
  });

  return { count: dbUsers.length };
};
