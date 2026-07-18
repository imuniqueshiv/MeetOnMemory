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
import { indexMeeting } from "../utils/embeddingUtils.js";
import {
  processStructuredMoM,
  detectResolutions,
} from "./knowledgeGraphService.js";
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
import { generateMoMWithAI, normalizeMoM, buildHumanReadableMoM } from "./GenerativeAIService.js";
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
    transcript: transcriptText,
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

  meeting.transcript = transcriptText;
  meeting.fileUrl = file.path;
  meeting.status = "completed";
  await meeting.save();

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

export const generateMeetingMoM = async (
  userId,
  meetingId,
  transcript,
  date,
  title,
  io,
) => {
  if (meetingId && !isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  let textToSummarize = (transcript || "").trim();
  let meeting = null;

  if (meetingId && !textToSummarize) {
    meeting = await MeetingStorageService.findMeetingById(meetingId);
    if (!meeting) throw new NotFoundError("Meeting not found");
    textToSummarize = (meeting.transcript || "").trim();
  }

  if (!textToSummarize) {
    throw new ValidationError("No transcript provided.");
  }

  if (aiQueue) {
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
      title: mom.title,
      date: new Date(date),
      transcript: textToSummarize,
      summary: momText,
      structuredMoM: mom,
      status: "completed",
    });
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
    doc || (await MeetingStorageService.findMeetingByQuery({ _id: meetingId, uploadedBy: userId }));
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

  indexMeeting(meeting).catch((err) =>
    console.error("⚠️ indexMeeting error (continuing):", err.message),
  );

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
    await doc.deleteOne();

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

export const searchMeetings = async ({ query, audioUrl }) => {
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
  const results = await MeetingStorageService.searchMeetingsRecords(searchQuery);

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
