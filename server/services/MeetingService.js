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
import Meeting from "../models/meetingModel.js";
import Membership from "../models/membershipModel.js";
import AiSummaryTemplate from "../models/aiSummaryTemplateModel.js";
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
import { normalizeAgendaItems } from "../utils/agendaOrdering.js";
import {
  deletedMeetingsFilter,
  escapeRegExp,
} from "../utils/meetingSoftDelete.js";

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

export const buildDuplicateMeetingData = (meeting) => {
  if (!meeting) throw new NotFoundError("Meeting not found");

  const plain =
    typeof meeting.toObject === "function" ? meeting.toObject() : meeting;

  return {
    sourceMeetingId: plain._id?.toString?.() || String(plain._id || ""),
    title: `${plain.title || "Untitled Meeting"} (Copy)`,
    description: plain.description || "",
    organization:
      plain.organization?.toString?.() || plain.organization || null,
    meetingType: plain.meetingType || "conference",
    date: "",
    time: "",
    duration: plain.duration ?? null,
    location: plain.location || "",
    venue: plain.venue || "",
    participants: (plain.participants || []).map((participant) => ({
      name: participant.name || "",
      email: participant.email || "",
      role: participant.role || "",
    })),
    agendaItems: (plain.agendaItems || []).map((item) => ({
      text: item.text || "",
      description: item.description || "",
      duration: item.duration ?? null,
    })),
    tags: [...(plain.tags || [])],
    policyDetails: plain.policyDetails
      ? {
          policyName: plain.policyDetails.policyName || "",
          policyVersion: plain.policyDetails.policyVersion || "",
          effectiveDate: plain.policyDetails.effectiveDate || null,
          approvalRequired: Boolean(plain.policyDetails.approvalRequired),
        }
      : null,
    recordingType: plain.recordingType || "upload",
  };
};

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
    agendaItems: normalizeAgendaItems(data.agendaItems),
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

  let customInstructions = null;
  try {
    if (meeting) {
      if (meeting.aiSummaryTemplate) {
        const template = await AiSummaryTemplate.findById(
          meeting.aiSummaryTemplate,
        );
        if (template) customInstructions = template.customInstructions;
      } else if (meeting.organization) {
        const defaultTemplate = await AiSummaryTemplate.findOne({
          organization: meeting.organization,
          isDefault: true,
        });
        if (defaultTemplate)
          customInstructions = defaultTemplate.customInstructions;
      }
    } else if (user && user.organization) {
      const defaultTemplate = await AiSummaryTemplate.findOne({
        organization: user.organization,
        isDefault: true,
      });
      if (defaultTemplate)
        customInstructions = defaultTemplate.customInstructions;
    }
  } catch (err) {
    console.error(
      "⚠️ Failed to fetch AI summary template instructions:",
      err.message,
    );
  }

  const { generateMoMWithAI, normalizeMoM, buildHumanReadableMoM } =
    await loadGenerativeAI();
  const structured = await generateMoMWithAI(
    textToSummarize,
    date,
    title,
    customInstructions,
  );
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
    search = "",
    sortBy = "createdAt",
    sortOrder = "desc",
    meetingType,
    startDate,
    endDate,
    includeArchived,
  } = queryParams;

  const normalizedPage = Math.max(parseInt(page, 10) || 1, 1);
  const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  const baseConditions = [];

  if (orgId) {
    baseConditions.push({
      $or: [{ uploadedBy: userId }, { organization: orgId }],
    });
  } else {
    baseConditions.push({ uploadedBy: userId });
  }

  if (!includeArchived) {
    baseConditions.push({ archived: { $ne: true } });
  }

  if (meetingType) {
    baseConditions.push({ meetingType });
  }

  if (startDate || endDate) {
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    baseConditions.push({ date: dateFilter });
  }

  if (search && search.trim()) {
    const searchRegex = escapeRegExp(search.trim());
    baseConditions.push({
      $or: [
        { title: { $regex: searchRegex, $options: "i" } },
        { summary: { $regex: searchRegex, $options: "i" } },
      ],
    });
  }

  const query = baseConditions.length > 0 ? { $and: baseConditions } : {};

  const skip = (normalizedPage - 1) * normalizedLimit;

  // Sort mapping
  const validSortFields = [
    "title",
    "date",
    "createdAt",
    "duration",
    "meetingType",
  ];
  const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sort = { [sortField]: sortDirection };

  const [meetings, total] = await Promise.all([
    MeetingStorageService.getMeetingsQuery(query, skip, normalizedLimit, sort),
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
    agendaItems,
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
  if (agendaItems !== undefined) {
    meeting.agendaItems = normalizeAgendaItems(agendaItems);
  }

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

export const deleteMeeting = async (doc, meetingId, actorId, reason = null) => {
  const meeting =
    doc ||
    (isValidObjectId(meetingId) ? await Meeting.findById(meetingId) : null);

  if (!meeting) throw new NotFoundError("Meeting not found");
  if (meeting.deletedAt) {
    throw new ValidationError("Meeting is already in the recycle bin");
  }

  meeting.deletedAt = new Date();
  meeting.deletedBy = actorId;
  meeting.deletionReason = reason || null;
  await meeting.save();

  try {
    eventBus.emit("meeting.soft_deleted", meeting);
  } catch (evtErr) {
    console.error(
      "⚠️ Failed to emit meeting.soft_deleted event:",
      evtErr.message,
    );
  }

  return meeting;
};

export const getDeletedMeetings = async (
  organizationId,
  { page = 1, limit = 20, search = "" } = {},
) => {
  const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const normalizedLimit = Math.min(
    Math.max(Number.parseInt(limit, 10) || 20, 1),
    100,
  );
  const query = deletedMeetingsFilter({ organization: organizationId });

  if (search.trim()) {
    query.title = { $regex: escapeRegExp(search.trim()), $options: "i" };
  }

  const skip = (normalizedPage - 1) * normalizedLimit;
  const [meetings, total] = await Promise.all([
    Meeting.find(query)
      .sort({ deletedAt: -1 })
      .skip(skip)
      .limit(normalizedLimit)
      .select(
        "title date meetingType status deletedAt deletedBy deletionReason createdAt",
      )
      .populate("deletedBy", "name email"),
    Meeting.countDocuments(query),
  ]);

  return {
    meetings,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages: Math.ceil(total / normalizedLimit),
    },
  };
};

export const restoreDeletedMeeting = async (meetingId, organizationId) => {
  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  const meeting = await Meeting.findOne({
    _id: meetingId,
    organization: organizationId,
    deletedAt: { $ne: null },
  });
  if (!meeting) throw new NotFoundError("Deleted meeting not found");

  meeting.deletedAt = null;
  meeting.deletedBy = null;
  meeting.deletionReason = null;
  await meeting.save();
  eventBus.emit("meeting.restored", meeting);
  return meeting;
};

export const permanentlyDeleteMeeting = async (meetingId, organizationId) => {
  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting ID");
  }

  const meeting = await Meeting.findOne({
    _id: meetingId,
    organization: organizationId,
    deletedAt: { $ne: null },
  });
  if (!meeting) throw new NotFoundError("Deleted meeting not found");

  await meeting.deleteOne();
  scheduleDeleteFromPinecone(meetingId);
  eventBus.emit("meeting.permanently_deleted", meeting);
  return meeting;
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
